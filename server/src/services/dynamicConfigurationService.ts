import { getSuggestionConfig, type SuggestionConfig } from "../config/suggestionConfig.js";
import { logger } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";

export interface ConfigChange {
  id: string;
  timestamp: Date;
  userId?: string | undefined;
  configPath: string;
  oldValue: any;
  newValue: any;
  reason?: string | undefined;
  autoApplied?: boolean;
}

export interface ConfigValidationRule {
  path: string;
  validator: (value: any) => boolean | string;
  message: string;
}

export interface DynamicConfigSchema {
  thresholds: {
    ai: { min: number; max: number; default: number };
    contextual: { min: number; max: number; default: number };
    heuristic: { min: number; max: number; default: number };
    brandkit: { min: number; max: number; default: number };
    minimum: { min: number; max: number; default: number };
  };
  sourcePriority: {
    ai: { min: number; max: number; default: number };
    contextual: { min: number; max: number; default: number };
    heuristic: { min: number; max: number; default: number };
    brandkit: { min: number; max: number; default: number };
  };
  autoApplyThresholds: {
    ai: { min: number; max: number; default: number };
    contextual: { min: number; max: number; default: number };
    heuristic: { min: number; max: number; default: number };
    brandkit: { min: number; max: number; default: number };
  };
  maxSuggestions: {
    ai: { min: number; max: number; default: number };
    contextual: { min: number; max: number; default: number };
    heuristic: { min: number; max: number; default: number };
    brandkit: { min: number; max: number; default: number };
    total: { min: number; max: number; default: number };
  };
  domainMultipliers: {
    email: { min: number; max: number; default: number };
    version: { min: number; max: number; default: number };
    url: { min: number; max: number; default: number };
    brand: { min: number; max: number; default: number };
    product: { min: number; max: number; default: number };
    contact: { min: number; max: number; default: number };
  };
}

export interface ConfigExperiment {
  id: string;
  name: string;
  description: string;
  configChanges: Partial<SuggestionConfig>;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'paused' | 'cancelled';
  metrics: {
    requestCount: number;
    averagePerformance: number;
    userSatisfaction: number;
    errorRate: number;
  };
  controlGroup: {
    size: number;
    performance: number;
  };
  testGroup: {
    size: number;
    performance: number;
  };
}

class DynamicConfigurationService extends EventEmitter {
  private currentConfig: SuggestionConfig;
  private configHistory: ConfigChange[] = [];
  private validationRules: ConfigValidationRule[] = [];
  private configSchema: DynamicConfigSchema;
  private activeExperiments: Map<string, ConfigExperiment> = new Map();
  private configBackups: Map<string, SuggestionConfig> = new Map();
  private autoOptimization = false;
  private optimizationInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.currentConfig = getSuggestionConfig();
    this.configSchema = this.initializeConfigSchema();
    this.setupValidationRules();
    this.initializeService();
  }

  // Update configuration with validation and change tracking
  async updateConfig(
    configPath: string,
    newValue: any,
    options?: {
      userId?: string | undefined;
      reason?: string | undefined;
      validateOnly?: boolean;
      force?: boolean;
    }
  ): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    configChange?: ConfigChange | undefined;
  }> {
    const result = {
      success: false,
      errors: [] as string[],
      warnings: [] as string[],
      configChange: undefined as ConfigChange | undefined
    };

    try {
      // Validate the change
      const validation = this.validateConfigChange(configPath, newValue);
      if (!validation.valid && !options?.force) {
        result.errors = validation.errors;
        return result;
      }

      result.warnings = validation.warnings;

      // If validation only, return success without applying
      if (options?.validateOnly) {
        result.success = true;
        return result;
      }

      // Get current value for history
      const oldValue = this.getConfigValue(configPath);

      // Create backup before change
      const backupId = `backup_${Date.now()}`;
      this.configBackups.set(backupId, { ...this.currentConfig });

      // Apply the change
      this.setConfigValue(configPath, newValue);

      // Create change record
      const configChange: ConfigChange = {
        id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: options?.userId,
        configPath,
        oldValue,
        newValue,
        reason: options?.reason,
        autoApplied: false
      };

      this.configHistory.push(configChange);
      result.configChange = configChange;

      // Emit change event
      this.emit('configChanged', configChange);

      // Save to persistent storage
      await this.saveConfig();

      result.success = true;

      logger.info("Configuration updated", {
        configPath,
        userId: options?.userId,
        reason: options?.reason,
        changeId: configChange.id
      });

    } catch (error: any) {
      result.errors.push(`Failed to update configuration: ${error.message}`);
      logger.error("Configuration update failed", {
        configPath,
        error: error.message,
        userId: options?.userId
      });
    }

    return result;
  }

  // Batch update multiple configuration values
  async batchUpdateConfig(
    updates: Array<{
      path: string;
      value: any;
      reason?: string | undefined;
    }>,
    options?: {
      userId?: string | undefined;
      validateOnly?: boolean;
      force?: boolean;
    }
  ): Promise<{
    success: boolean;
    results: Array<{
      path: string;
      success: boolean;
      errors: string[];
      warnings: string[];
    }>;
  }> {
    const results = [];
    let overallSuccess = true;

    // Create backup before batch update
    const backupId = `batch_backup_${Date.now()}`;
    this.configBackups.set(backupId, { ...this.currentConfig });

    for (const update of updates) {
      const result = await this.updateConfig(update.path, update.value, {
        ...options,
        reason: update.reason || undefined
      });

      results.push({
        path: update.path,
        success: result.success,
        errors: result.errors,
        warnings: result.warnings
      });

      if (!result.success) {
        overallSuccess = false;
      }
    }

    // If any updates failed and not in force mode, rollback
    if (!overallSuccess && !options?.force && !options?.validateOnly) {
      await this.rollbackToBackup(backupId);
      logger.warn("Batch update failed, rolled back changes", { 
        backupId,
        failedUpdates: results.filter(r => !r.success).length 
      });
    }

    return {
      success: overallSuccess,
      results
    };
  }

  // Start an A/B testing experiment with configuration changes
  async startExperiment(experiment: {
    name: string;
    description: string;
    configChanges: Partial<SuggestionConfig>;
    duration?: number; // in milliseconds
    trafficSplit?: number; // percentage for test group (0-100)
  }): Promise<{
    success: boolean;
    experimentId?: string | undefined;
    errors: string[];
  }> {
    const result = {
      success: false,
      experimentId: undefined as string | undefined,
      errors: [] as string[]
    };

    try {
      // Validate experiment configuration
      const validation = this.validateExperimentConfig(experiment.configChanges);
      if (!validation.valid) {
        result.errors = validation.errors;
        return result;
      }

      const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const configExperiment: ConfigExperiment = {
        id: experimentId,
        name: experiment.name,
        description: experiment.description,
        configChanges: experiment.configChanges,
        startTime: new Date(),
        status: 'running',
        metrics: {
          requestCount: 0,
          averagePerformance: 0,
          userSatisfaction: 0,
          errorRate: 0
        },
        controlGroup: {
          size: 0,
          performance: 0
        },
        testGroup: {
          size: 0,
          performance: 0
        }
      };

      // Set end time if duration specified
      if (experiment.duration) {
        configExperiment.endTime = new Date(Date.now() + experiment.duration);
      }

      this.activeExperiments.set(experimentId, configExperiment);

      // Emit experiment started event
      this.emit('experimentStarted', configExperiment);

      result.success = true;
      result.experimentId = experimentId;

      logger.info("Configuration experiment started", {
        experimentId,
        name: experiment.name,
        duration: experiment.duration,
        configChanges: Object.keys(experiment.configChanges)
      });

    } catch (error: any) {
      result.errors.push(`Failed to start experiment: ${error.message}`);
      logger.error("Experiment start failed", {
        name: experiment.name,
        error: error.message
      });
    }

    return result;
  }

  // Get configuration for a specific request (may be experimental)
  getConfigForRequest(requestContext?: {
    userId?: string | undefined;
    experimentGroup?: string | undefined;
    sessionId?: string | undefined;
  }): SuggestionConfig {
    // Check if request should use experimental config
    for (const experiment of this.activeExperiments.values()) {
      if (experiment.status === 'running' && this.shouldUseExperimentalConfig(experiment, requestContext)) {
        // Merge experimental changes with base config
        return this.mergeConfigs(this.currentConfig, experiment.configChanges);
      }
    }

    return this.currentConfig;
  }

  // Enable automatic optimization based on performance metrics
  enableAutoOptimization(options?: {
    interval?: number; // Check interval in ms
    performanceThreshold?: number; // Minimum improvement threshold
    conservativeMode?: boolean; // Only make small incremental changes
  }): void {
    this.autoOptimization = true;
    
    const interval = options?.interval || 60 * 60 * 1000; // 1 hour default
    
    this.optimizationInterval = setInterval(() => {
      this.performAutoOptimization(options);
    }, interval);

    logger.info("Auto-optimization enabled", { 
      interval,
      conservativeMode: options?.conservativeMode
    });
  }

  // Disable automatic optimization
  disableAutoOptimization(): void {
    this.autoOptimization = false;
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    logger.info("Auto-optimization disabled");
  }

  // Get configuration history and analytics
  getConfigAnalytics(): {
    totalChanges: number;
    recentChanges: ConfigChange[];
    changesByUser: Record<string, number>;
    changesByPath: Record<string, number>;
    performanceImpact: {
      positive: number;
      negative: number;
      neutral: number;
    };
    activeExperiments: ConfigExperiment[];
  } {
    const recentChanges = this.configHistory
      .filter(change => Date.now() - change.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const changesByUser: Record<string, number> = {};
    const changesByPath: Record<string, number> = {};

    this.configHistory.forEach(change => {
      const user = change.userId || 'system';
      changesByUser[user] = (changesByUser[user] || 0) + 1;
      changesByPath[change.configPath] = (changesByPath[change.configPath] || 0) + 1;
    });

    // Simplified performance impact analysis
    const performanceImpact = {
      positive: 0,
      negative: 0,
      neutral: 0
    };

    return {
      totalChanges: this.configHistory.length,
      recentChanges,
      changesByUser,
      changesByPath,
      performanceImpact,
      activeExperiments: Array.from(this.activeExperiments.values())
    };
  }

  // Export configuration and history
  async exportConfig(): Promise<string> {
    const dataDir = path.join(process.cwd(), 'data', 'config');
    await fs.mkdir(dataDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `config_export_${timestamp}.json`;
    const filepath = path.join(dataDir, filename);

    const exportData = {
      currentConfig: this.currentConfig,
      configHistory: this.configHistory,
      configSchema: this.configSchema,
      activeExperiments: Array.from(this.activeExperiments.entries()),
      backups: Array.from(this.configBackups.entries()),
      exportedAt: new Date()
    };

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    
    logger.info("Configuration exported", { filepath });
    return filepath;
  }

  // Rollback to a previous configuration
  async rollbackToBackup(backupId: string): Promise<boolean> {
    const backup = this.configBackups.get(backupId);
    if (!backup) {
      logger.error("Backup not found", { backupId });
      return false;
    }

    try {
      const oldConfig = { ...this.currentConfig };
      this.currentConfig = { ...backup };

      // Record rollback as a config change
      const rollbackChange: ConfigChange = {
        id: `rollback_${Date.now()}`,
        timestamp: new Date(),
        configPath: 'full_config',
        oldValue: oldConfig,
        newValue: this.currentConfig,
        reason: `Rollback to backup ${backupId}`,
        autoApplied: false
      };

      this.configHistory.push(rollbackChange);
      this.emit('configChanged', rollbackChange);

      await this.saveConfig();

      logger.info("Configuration rolled back", { backupId });
      return true;

    } catch (error: any) {
      logger.error("Rollback failed", { backupId, error: error.message });
      return false;
    }
  }

  // Private methods

  private initializeConfigSchema(): DynamicConfigSchema {
    return {
      thresholds: {
        ai: { min: 0.1, max: 1.0, default: 0.7 },
        contextual: { min: 0.1, max: 1.0, default: 0.6 },
        heuristic: { min: 0.1, max: 1.0, default: 0.4 },
        brandkit: { min: 0.1, max: 1.0, default: 0.8 },
        minimum: { min: 0.0, max: 0.9, default: 0.3 }
      },
      sourcePriority: {
        ai: { min: 1, max: 10, default: 4 },
        contextual: { min: 1, max: 10, default: 3 },
        heuristic: { min: 1, max: 10, default: 1 },
        brandkit: { min: 1, max: 10, default: 5 }
      },
      autoApplyThresholds: {
        ai: { min: 0.5, max: 1.0, default: 0.9 },
        contextual: { min: 0.5, max: 1.0, default: 0.85 },
        heuristic: { min: 0.5, max: 1.0, default: 0.8 },
        brandkit: { min: 0.5, max: 1.0, default: 0.9 }
      },
      maxSuggestions: {
        ai: { min: 1, max: 20, default: 5 },
        contextual: { min: 1, max: 10, default: 3 },
        heuristic: { min: 1, max: 25, default: 10 },
        brandkit: { min: 1, max: 15, default: 8 },
        total: { min: 1, max: 50, default: 15 }
      },
      domainMultipliers: {
        email: { min: 0.5, max: 2.0, default: 1.2 },
        version: { min: 0.5, max: 2.0, default: 1.1 },
        url: { min: 0.5, max: 2.0, default: 1.3 },
        brand: { min: 0.5, max: 2.0, default: 1.5 },
        product: { min: 0.5, max: 2.0, default: 1.4 },
        contact: { min: 0.5, max: 2.0, default: 1.2 }
      }
    };
  }

  private setupValidationRules(): void {
    // Threshold validation
    this.validationRules.push({
      path: 'thresholds.*',
      validator: (value: number) => value >= 0 && value <= 1,
      message: 'Thresholds must be between 0 and 1'
    });

    // Priority validation
    this.validationRules.push({
      path: 'sourcePriority.*',
      validator: (value: number) => Number.isInteger(value) && value >= 1 && value <= 10,
      message: 'Source priorities must be integers between 1 and 10'
    });

    // Max suggestions validation
    this.validationRules.push({
      path: 'maxSuggestions.*',
      validator: (value: number) => Number.isInteger(value) && value >= 1 && value <= 50,
      message: 'Max suggestions must be integers between 1 and 50'
    });

    // Domain multipliers validation
    this.validationRules.push({
      path: 'domainMultipliers.*',
      validator: (value: number) => value >= 0.1 && value <= 3.0,
      message: 'Domain multipliers must be between 0.1 and 3.0'
    });
  }

  private initializeService(): void {
    // Load configuration from file if exists
    this.loadConfigFromFile().catch(() => {
      logger.debug("No existing config file found, using defaults");
    });

    // Start periodic backups
    setInterval(() => {
      this.createPeriodicBackup();
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    logger.info("Dynamic configuration service initialized");
  }

  private validateConfigChange(path: string, value: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check if path exists in schema
    const schemaValue = this.getSchemaValue(path);
    if (!schemaValue) {
      result.errors.push(`Configuration path '${path}' not found in schema`);
      result.valid = false;
      return result;
    }

    // Validate against schema constraints
    if (typeof value === 'number') {
      if (value < schemaValue.min) {
        result.errors.push(`Value ${value} is below minimum ${schemaValue.min} for path '${path}'`);
        result.valid = false;
      }
      if (value > schemaValue.max) {
        result.errors.push(`Value ${value} is above maximum ${schemaValue.max} for path '${path}'`);
        result.valid = false;
      }
    }

    // Apply validation rules
    for (const rule of this.validationRules) {
      if (this.pathMatches(path, rule.path)) {
        const validationResult = rule.validator(value);
        if (validationResult !== true) {
          if (typeof validationResult === 'string') {
            result.errors.push(validationResult);
          } else {
            result.errors.push(rule.message);
          }
          result.valid = false;
        }
      }
    }

    return result;
  }

  private validateExperimentConfig(configChanges: Partial<SuggestionConfig>): {
    valid: boolean;
    errors: string[];
  } {
    const result = {
      valid: true,
      errors: [] as string[]
    };

    // Validate each change in the experiment
    for (const [path, value] of Object.entries(configChanges)) {
      const validation = this.validateConfigChange(path, value);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        result.valid = false;
      }
    }

    return result;
  }

  private getConfigValue(path: string): any {
    const parts = path.split('.');
    let current: any = this.currentConfig;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setConfigValue(path: string, value: any): void {
    const parts = path.split('.');
    let current: any = this.currentConfig;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]!] = value;
  }

  private getSchemaValue(path: string): any {
    const parts = path.split('.');
    let current: any = this.configSchema;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private pathMatches(path: string, pattern: string): boolean {
    const pathParts = path.split('.');
    const patternParts = pattern.split('.');
    
    if (pathParts.length !== patternParts.length) {
      return false;
    }
    
    for (let i = 0; i < pathParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== pathParts[i]) {
        return false;
      }
    }
    
    return true;
  }

  private shouldUseExperimentalConfig(
    experiment: ConfigExperiment,
    requestContext?: any
  ): boolean {
    // Simple hash-based assignment for consistent user experience
    if (requestContext?.userId) {
      const hash = this.hashString(requestContext.userId + experiment.id);
      return (hash % 100) < 50; // 50% split
    }
    
    // Random assignment for anonymous users
    return Math.random() < 0.5;
  }

  private mergeConfigs(base: SuggestionConfig, changes: Partial<SuggestionConfig>): SuggestionConfig {
    const merged = { ...base };
    
    for (const [key, value] of Object.entries(changes)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (merged as any)[key] = { ...(merged as any)[key], ...value };
      } else {
        (merged as any)[key] = value;
      }
    }
    
    return merged;
  }

  private async performAutoOptimization(options?: any): Promise<void> {
    // Placeholder for auto-optimization logic
    // Would analyze performance metrics and make incremental improvements
    logger.debug("Auto-optimization analysis performed");
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async saveConfig(): Promise<void> {
    const configDir = path.join(process.cwd(), 'data', 'config');
    await fs.mkdir(configDir, { recursive: true });
    
    const configPath = path.join(configDir, 'dynamic_config.json');
    await fs.writeFile(configPath, JSON.stringify(this.currentConfig, null, 2));
  }

  private async loadConfigFromFile(): Promise<void> {
    const configPath = path.join(process.cwd(), 'data', 'config', 'dynamic_config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);
      
      // Validate loaded config
      const validation = this.validateExperimentConfig(loadedConfig);
      if (validation.valid) {
        this.currentConfig = loadedConfig;
        logger.info("Configuration loaded from file");
      } else {
        logger.warn("Invalid configuration file, using defaults", { 
          errors: validation.errors 
        });
      }
    } catch (error: any) {
      logger.debug("Could not load configuration file", { error: error.message });
    }
  }

  private createPeriodicBackup(): void {
    const backupId = `periodic_${Date.now()}`;
    this.configBackups.set(backupId, { ...this.currentConfig });
    
    // Keep only last 10 backups
    if (this.configBackups.size > 10) {
      const oldest = Array.from(this.configBackups.keys())[0];
      if (oldest) {
        this.configBackups.delete(oldest);
      }
    }
    
    logger.debug("Periodic config backup created", { backupId });
  }
}

export const dynamicConfigurationService = new DynamicConfigurationService();
