import { logger } from "../utils/logger.js";
import type { ReplacementSuggestion } from "./suggestionService.js";
import type { UserFeedback } from "./scoringService.js";

export interface DomainPattern {
  domain: string;
  entityType: string;
  patterns: string[];
  confidence: number;
  frequency: number;
  successRate: number;
  lastUpdated: Date;
  contextKeywords: string[];
  examples: string[];
}

export interface AdaptiveThreshold {
  domain: string;
  entityType: string;
  baseThreshold: number;
  adaptedThreshold: number;
  performanceHistory: number[];
  lastAdjustment: Date;
  adjustmentReason: string;
}

export interface DomainContext {
  contentTypeUid?: string | undefined;
  industry?: string | undefined;
  brandContext?: string | undefined;
  userSegment?: string | undefined;
  historicalPatterns?: DomainPattern[] | undefined;
}

class AdaptiveDomainService {
  private domainPatterns: Map<string, DomainPattern> = new Map();
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private domainDetectionRules: Map<string, RegExp[]> = new Map();
  private industryMappings: Map<string, string[]> = new Map();
  private contextCache: Map<string, DomainContext> = new Map();

  constructor() {
    this.initializeDefaultDomains();
    this.setupDomainDetectionRules();
    this.initializeIndustryMappings();
  }

  
  // Automatically detect and map domains from content
   
  detectAndMapDomains(
    text: string,
    context?: {
      contentTypeUid?: string;
      entryUid?: string;
      metadata?: Record<string, any>;
    }
  ): DomainContext {
    const cacheKey = this.generateCacheKey(text, context);
    const cached = this.contextCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const detectedDomains = this.detectDomainsFromText(text);
    const contentTypeDomain = this.detectDomainFromContentType(context?.contentTypeUid);
    const industryDomain = this.detectIndustryFromMetadata(context?.metadata);

    // Combine and prioritize domain detections
    const primaryDomain = this.selectPrimaryDomain([
      ...detectedDomains,
      contentTypeDomain,
      industryDomain
    ].filter(Boolean) as string[]);

    const domainContext: DomainContext = {
      contentTypeUid: context?.contentTypeUid,
      industry: industryDomain || undefined,
      brandContext: this.extractBrandContext(text, context),
      userSegment: this.inferUserSegment(context),
      historicalPatterns: this.getHistoricalPatterns(primaryDomain)
    };

    this.contextCache.set(cacheKey, domainContext);
    
    logger.info("Domain mapping completed", {
      primaryDomain,
      detectedDomains,
      contentTypeUid: context?.contentTypeUid
    });

    return domainContext;
  }

  // Get adaptive thresholds for a specific domain and entity type
  getAdaptiveThreshold(domain: string, entityType: string): number {
    const thresholdKey = `${domain}_${entityType}`;
    const adaptiveThreshold = this.adaptiveThresholds.get(thresholdKey);

    if (adaptiveThreshold) {
      return adaptiveThreshold.adaptedThreshold;
    }

    // Return default threshold for unknown combinations
    return this.getDefaultThreshold(domain, entityType);
  }

  // Learn from user feedback and adjust domain mappings
  learnFromFeedback(
    feedback: UserFeedback,
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): void {
    this.updateDomainPatterns(feedback, suggestion, domainContext);
    this.adjustThresholds(feedback, suggestion, domainContext);
    this.updateDetectionRules(feedback, suggestion, domainContext);

    logger.info("Domain learning updated", {
      domain: domainContext.industry,
      entityType: feedback.entityType,
      accepted: feedback.accepted,
      confidence: feedback.confidence
    });
  }

  // Generate domain-specific confidence adjustments
  calculateDomainAdjustment(
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): number {
    const domain = domainContext.industry || 'general';
    const entityType = suggestion.entity.type;
    
    // Get pattern-based adjustment
    const patternAdjustment = this.getPatternBasedAdjustment(suggestion, domainContext);
    
    // Get historical performance adjustment
    const performanceAdjustment = this.getPerformanceBasedAdjustment(domain, entityType);
    
    // Get context-specific adjustment
    const contextAdjustment = this.getContextBasedAdjustment(suggestion, domainContext);

    // Combine adjustments with weights
    const totalAdjustment = (
      patternAdjustment * 0.4 +
      performanceAdjustment * 0.35 +
      contextAdjustment * 0.25
    );

    return Math.max(0.1, Math.min(2.0, 1.0 + totalAdjustment));
  }

  // Auto-detect new domains from content patterns
  autoDetectNewDomains(
    suggestions: ReplacementSuggestion[],
    context?: any
  ): string[] {
    const newDomains: string[] = [];
    const contentAnalysis = this.analyzeContentForDomains(suggestions, context);

    for (const [domain, confidence] of Object.entries(contentAnalysis)) {
      if (confidence > 0.7 && !this.isKnownDomain(domain)) {
        newDomains.push(domain);
        this.registerNewDomain(domain, confidence);
      }
    }

    if (newDomains.length > 0) {
      logger.info("New domains detected", { newDomains });
    }

    return newDomains;
  }

  // Get domain-specific validation rules
  getDomainValidationRules(domain: string): Record<string, any> {
    const rules: Record<string, any> = {
      general: {
        minConfidence: 0.3,
        maxSuggestions: 15,
        requiresApproval: false
      }
    };

    // Domain-specific rules
    switch (domain.toLowerCase()) {
      case 'finance':
      case 'banking':
        rules[domain] = {
          minConfidence: 0.8,
          maxSuggestions: 5,
          requiresApproval: true,
          sensitiveTerms: ['price', 'rate', 'fee', 'cost']
        };
        break;
        
      case 'healthcare':
      case 'medical':
        rules[domain] = {
          minConfidence: 0.9,
          maxSuggestions: 3,
          requiresApproval: true,
          sensitiveTerms: ['dosage', 'treatment', 'diagnosis', 'medicine']
        };
        break;
        
      case 'legal':
        rules[domain] = {
          minConfidence: 0.85,
          maxSuggestions: 3,
          requiresApproval: true,
          sensitiveTerms: ['contract', 'agreement', 'terms', 'liability']
        };
        break;
        
      case 'ecommerce':
      case 'retail':
        rules[domain] = {
          minConfidence: 0.6,
          maxSuggestions: 10,
          requiresApproval: false,
          sensitiveTerms: ['price', 'discount', 'shipping', 'return']
        };
        break;
        
      case 'technology':
      case 'software':
        rules[domain] = {
          minConfidence: 0.5,
          maxSuggestions: 12,
          requiresApproval: false,
          sensitiveTerms: ['version', 'api', 'security', 'data']
        };
        break;
    }

    return rules[domain] || rules.general;
  }

  // Private helper methods

  private initializeDefaultDomains(): void {
    const defaultDomains = [
      'ecommerce', 'technology', 'healthcare', 'finance', 'education',
      'entertainment', 'travel', 'automotive', 'real-estate', 'legal',
      'marketing', 'media', 'sports', 'food', 'fashion'
    ];

    defaultDomains.forEach(domain => {
      this.domainPatterns.set(domain, {
        domain,
        entityType: 'general',
        patterns: [],
        confidence: 0.5,
        frequency: 0,
        successRate: 0.5,
        lastUpdated: new Date(),
        contextKeywords: [],
        examples: []
      });
    });
  }

  private setupDomainDetectionRules(): void {
    this.domainDetectionRules.set('ecommerce', [
      /\b(shop|store|buy|purchase|cart|checkout|payment|shipping|product|catalog)\b/i,
      /\b(price|cost|discount|sale|offer|deal|coupon)\b/i
    ]);

    this.domainDetectionRules.set('technology', [
      /\b(software|app|api|code|programming|developer|system|platform)\b/i,
      /\b(version|update|release|deploy|server|database|cloud)\b/i
    ]);

    this.domainDetectionRules.set('healthcare', [
      /\b(medical|health|patient|doctor|hospital|treatment|diagnosis|medicine)\b/i,
      /\b(symptom|therapy|clinic|surgery|prescription|pharmacy)\b/i
    ]);

    this.domainDetectionRules.set('finance', [
      /\b(bank|finance|money|loan|credit|investment|insurance|tax)\b/i,
      /\b(account|balance|payment|transaction|interest|rate|fee)\b/i
    ]);

    this.domainDetectionRules.set('education', [
      /\b(school|student|teacher|course|class|lesson|education|learning)\b/i,
      /\b(university|college|degree|certificate|exam|grade|study)\b/i
    ]);
  }

  private initializeIndustryMappings(): void {
    this.industryMappings.set('retail', ['ecommerce', 'shopping', 'store']);
    this.industryMappings.set('tech', ['technology', 'software', 'saas']);
    this.industryMappings.set('health', ['healthcare', 'medical', 'wellness']);
    this.industryMappings.set('financial', ['finance', 'banking', 'fintech']);
    this.industryMappings.set('education', ['learning', 'academic', 'training']);
  }

  private detectDomainsFromText(text: string): string[] {
    const detectedDomains: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [domain, rules] of this.domainDetectionRules.entries()) {
      let matches = 0;
      for (const rule of rules) {
        if (rule.test(lowerText)) {
          matches++;
        }
      }

      // If we have matches in multiple rule sets, consider it a strong indicator
      if (matches >= Math.ceil(rules.length * 0.5)) {
        detectedDomains.push(domain);
      }
    }

    return detectedDomains;
  }

  private detectDomainFromContentType(contentTypeUid?: string): string | null {
    if (!contentTypeUid) return null;

    const contentType = contentTypeUid.toLowerCase();
    
    for (const [industry, mappings] of this.industryMappings.entries()) {
      if (mappings.some(mapping => contentType.includes(mapping))) {
        return industry;
      }
    }

    // Direct keyword matching
    if (contentType.includes('product')) return 'ecommerce';
    if (contentType.includes('blog')) return 'media';
    if (contentType.includes('event')) return 'events';
    if (contentType.includes('news')) return 'media';

    return null;
  }

  private detectIndustryFromMetadata(metadata?: Record<string, any>): string | null {
    if (!metadata) return null;

    const metaString = JSON.stringify(metadata).toLowerCase();
    
    for (const [domain, rules] of this.domainDetectionRules.entries()) {
      if (rules.some(rule => rule.test(metaString))) {
        return domain;
      }
    }

    return null;
  }

  private selectPrimaryDomain(domains: string[]): string {
    if (domains.length === 0) return 'general';
    if (domains.length === 1) return domains[0]!;

    // Priority order for conflicting domains
    const priorityOrder = ['healthcare', 'finance', 'legal', 'technology', 'ecommerce'];
    
    for (const priority of priorityOrder) {
      if (domains.includes(priority)) {
        return priority;
      }
    }

    return domains[0]!;
  }

  private extractBrandContext(text: string, context?: any): string | undefined {
    // Extract brand-related context from text and metadata
    const brandKeywords = ['brand', 'company', 'logo', 'trademark', 'identity'];
    const lowerText = text.toLowerCase();

    if (brandKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'brand-focused';
    }

    return undefined;
  }

  private inferUserSegment(context?: any): string | undefined {
    // Infer user segment from context
    if (context?.contentTypeUid?.includes('admin')) return 'admin';
    if (context?.contentTypeUid?.includes('public')) return 'public';
    
    return undefined;
  }

  private getHistoricalPatterns(domain: string): DomainPattern[] {
    const patterns: DomainPattern[] = [];
    
    for (const [key, pattern] of this.domainPatterns.entries()) {
      if (pattern.domain === domain) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private generateCacheKey(text: string, context?: any): string {
    const contextKey = context ? JSON.stringify(context) : '';
    return `${text.substring(0, 100)}_${contextKey}`.replace(/[^\w]/g, '');
  }

  private getDefaultThreshold(domain: string, entityType: string): number {
    const domainThresholds: Record<string, number> = {
      'healthcare': 0.9,
      'finance': 0.85,
      'legal': 0.8,
      'technology': 0.6,
      'ecommerce': 0.5,
      'general': 0.4
    };

    return domainThresholds[domain] || 0.4;
  }

  private updateDomainPatterns(
    feedback: UserFeedback,
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): void {
    const domain = domainContext.industry || 'general';
    const patternKey = `${domain}_${suggestion.entity.type}`;
    
    const pattern = this.domainPatterns.get(patternKey) || {
      domain,
      entityType: suggestion.entity.type,
      patterns: [],
      confidence: 0.5,
      frequency: 0,
      successRate: 0.5,
      lastUpdated: new Date(),
      contextKeywords: [],
      examples: []
    };

    // Update pattern metrics
    pattern.frequency += 1;
    pattern.successRate = feedback.accepted
      ? (pattern.successRate * (pattern.frequency - 1) + 1) / pattern.frequency
      : (pattern.successRate * (pattern.frequency - 1)) / pattern.frequency;
    
    pattern.lastUpdated = new Date();

    // Add new patterns if successful
    if (feedback.accepted && feedback.confidence > 0.7) {
      const newPattern = suggestion.suggestedReplacement.toLowerCase();
      if (!pattern.patterns.includes(newPattern)) {
        pattern.patterns.push(newPattern);
      }

      if (suggestion.context && !pattern.contextKeywords.includes(suggestion.context)) {
        pattern.contextKeywords.push(suggestion.context);
      }
    }

    this.domainPatterns.set(patternKey, pattern);
  }

  private adjustThresholds(
    feedback: UserFeedback,
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): void {
    const domain = domainContext.industry || 'general';
    const thresholdKey = `${domain}_${suggestion.entity.type}`;
    
    let threshold = this.adaptiveThresholds.get(thresholdKey);
    
    if (!threshold) {
      threshold = {
        domain,
        entityType: suggestion.entity.type,
        baseThreshold: this.getDefaultThreshold(domain, suggestion.entity.type),
        adaptedThreshold: this.getDefaultThreshold(domain, suggestion.entity.type),
        performanceHistory: [],
        lastAdjustment: new Date(),
        adjustmentReason: 'Initial setup'
      };
    }

    // Add performance data
    threshold.performanceHistory.push(feedback.accepted ? 1 : 0);
    
    // Keep only last 50 data points
    if (threshold.performanceHistory.length > 50) {
      threshold.performanceHistory = threshold.performanceHistory.slice(-50);
    }

    // Adjust threshold based on recent performance
    const recentPerformance = threshold.performanceHistory.slice(-10);
    const recentAcceptanceRate = recentPerformance.reduce((sum, val) => sum + val, 0) / recentPerformance.length;

    if (recentAcceptanceRate < 0.3 && threshold.adaptedThreshold < 0.9) {
      // Poor performance, increase threshold
      threshold.adaptedThreshold = Math.min(threshold.adaptedThreshold + 0.05, 0.9);
      threshold.adjustmentReason = 'Poor acceptance rate';
    } else if (recentAcceptanceRate > 0.8 && threshold.adaptedThreshold > 0.2) {
      // Good performance, can lower threshold slightly
      threshold.adaptedThreshold = Math.max(threshold.adaptedThreshold - 0.02, 0.2);
      threshold.adjustmentReason = 'Good acceptance rate';
    }

    threshold.lastAdjustment = new Date();
    this.adaptiveThresholds.set(thresholdKey, threshold);
  }

  private updateDetectionRules(
    feedback: UserFeedback,
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): void {
    // Update domain detection rules based on successful patterns
    if (feedback.accepted && feedback.confidence > 0.8) {
      const domain = domainContext.industry;
      if (domain && suggestion.context) {
        const keywords = this.extractKeywords(suggestion.context);
        const existingRules = this.domainDetectionRules.get(domain) || [];
        
        // Add new detection patterns for frequently occurring keywords
        keywords.forEach(keyword => {
          if (keyword.length > 3) {
            const newRule = new RegExp(`\\b${keyword}\\b`, 'i');
            if (!existingRules.some(rule => rule.source === newRule.source)) {
              existingRules.push(newRule);
            }
          }
        });

        this.domainDetectionRules.set(domain, existingRules);
      }
    }
  }

  private getPatternBasedAdjustment(
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): number {
    const domain = domainContext.industry || 'general';
    const patternKey = `${domain}_${suggestion.entity.type}`;
    const pattern = this.domainPatterns.get(patternKey);

    if (!pattern) return 0;

    // Check if suggestion matches known successful patterns
    const suggestionLower = suggestion.suggestedReplacement.toLowerCase();
    const matchesPattern = pattern.patterns.some(p => 
      suggestionLower.includes(p) || p.includes(suggestionLower)
    );

    if (matchesPattern) {
      return pattern.successRate - 0.5; // Positive if above average success
    }

    return 0;
  }

  private getPerformanceBasedAdjustment(domain: string, entityType: string): number {
    const thresholdKey = `${domain}_${entityType}`;
    const threshold = this.adaptiveThresholds.get(thresholdKey);

    if (!threshold || threshold.performanceHistory.length < 5) return 0;

    const recentPerformance = threshold.performanceHistory.slice(-20);
    const acceptanceRate = recentPerformance.reduce((sum, val) => sum + val, 0) / recentPerformance.length;

    return (acceptanceRate - 0.5) * 0.3; // Scale to reasonable adjustment range
  }

  private getContextBasedAdjustment(
    suggestion: ReplacementSuggestion,
    domainContext: DomainContext
  ): number {
    let adjustment = 0;

    // Brand context boost
    if (domainContext.brandContext === 'brand-focused' && suggestion.source === 'brandkit') {
      adjustment += 0.2;
    }

    // User segment adjustment
    if (domainContext.userSegment === 'admin') {
      adjustment += 0.1; // Admins might prefer more suggestions
    }

    // Content type specific adjustments
    if (domainContext.contentTypeUid) {
      const contentType = domainContext.contentTypeUid.toLowerCase();
      
      if (contentType.includes('critical') || contentType.includes('important')) {
        adjustment += 0.15;
      }
      
      if (contentType.includes('draft') || contentType.includes('test')) {
        adjustment -= 0.1; // More lenient for drafts
      }
    }

    return adjustment;
  }

  private analyzeContentForDomains(
    suggestions: ReplacementSuggestion[],
    context?: any
  ): Record<string, number> {
    const domainScores: Record<string, number> = {};

    // Analyze entity types and contexts for domain indicators
    suggestions.forEach(suggestion => {
      const entityType = suggestion.entity.type.toLowerCase();
      const suggestionContext = (suggestion.context || '').toLowerCase();
      const reasonText = (suggestion.reason || '').toLowerCase();

      // Combine all text for analysis
      const analysisText = `${entityType} ${suggestionContext} ${reasonText}`;

      // Check against known domain patterns
      for (const [domain, rules] of this.domainDetectionRules.entries()) {
        let score = 0;
        for (const rule of rules) {
          if (rule.test(analysisText)) {
            score += 0.3;
          }
        }
        
        if (score > 0) {
          domainScores[domain] = (domainScores[domain] || 0) + score;
        }
      }
    });

    // Normalize scores
    const maxScore = Math.max(...Object.values(domainScores));
    if (maxScore > 0) {
      for (const domain in domainScores) {
        domainScores[domain] = domainScores[domain]! / maxScore;
      }
    }

    return domainScores;
  }

  private isKnownDomain(domain: string): boolean {
    return Array.from(this.domainPatterns.keys()).some(key => key.startsWith(domain));
  }

  private registerNewDomain(domain: string, confidence: number): void {
    this.domainPatterns.set(`${domain}_general`, {
      domain,
      entityType: 'general',
      patterns: [],
      confidence,
      frequency: 1,
      successRate: 0.5,
      lastUpdated: new Date(),
      contextKeywords: [],
      examples: []
    });

    logger.info("New domain registered", { domain, confidence });
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .slice(0, 10); // Limit to prevent excessive growth
  }

  // Comprehensive threshold validation and auto-calibration
  validateAndCalibrateThresholds(): {
    validationResults: ThresholdValidationResult[];
    calibrationActions: CalibrationAction[];
  } {
    const validationResults: ThresholdValidationResult[] = [];
    const calibrationActions: CalibrationAction[] = [];

    for (const [key, threshold] of this.adaptiveThresholds.entries()) {
      const result = this.validateSingleThreshold(threshold);
      validationResults.push(result);

      if (result.needsCalibration) {
        const action = this.generateCalibrationAction(threshold, result);
        calibrationActions.push(action);
        this.applyCalibrationAction(action);
      }
    }

    logger.info("Threshold validation completed", {
      totalThresholds: this.adaptiveThresholds.size,
      needsCalibration: calibrationActions.length,
      avgPerformance: this.calculateAveragePerformance()
    });

    return { validationResults, calibrationActions };
  }

  private validateSingleThreshold(threshold: AdaptiveThreshold): ThresholdValidationResult {
    const metrics = this.calculateThresholdMetrics(threshold);
    
    return {
      domain: threshold.domain,
      entityType: threshold.entityType,
      currentThreshold: threshold.adaptedThreshold,
      baseThreshold: threshold.baseThreshold,
      performance: metrics,
      needsCalibration: this.shouldCalibrateThreshold(metrics),
      calibrationConfidence: this.calculateCalibrationConfidence(metrics),
      lastValidation: new Date(),
      statisticalSignificance: this.calculateStatisticalSignificance(threshold.performanceHistory),
      recommendedRange: this.calculateRecommendedRange(metrics)
    };
  }

  private calculateThresholdMetrics(threshold: AdaptiveThreshold): ThresholdPerformanceMetrics {
    const history = threshold.performanceHistory;
    
    if (history.length === 0) {
      return {
        acceptanceRate: 0.5,
        precision: 0.5,
        recall: 0.5,
        f1Score: 0.5,
        stabilityIndex: 0,
        trendDirection: 'stable',
        recentPerformance: 0.5,
        sampleSize: 0
      };
    }

    const totalSamples = history.length;
    const acceptanceRate = history.reduce((sum, val) => sum + val, 0) / totalSamples;
    
    // Calculate recent performance (last 20% of samples)
    const recentCount = Math.max(1, Math.floor(totalSamples * 0.2));
    const recentSamples = history.slice(-recentCount);
    const recentPerformance = recentSamples.reduce((sum, val) => sum + val, 0) / recentCount;

    // Calculate stability (variance in recent performance)
    const windowSize = Math.min(10, totalSamples);
    const windows = [];
    for (let i = 0; i <= totalSamples - windowSize; i++) {
      const window = history.slice(i, i + windowSize);
      windows.push(window.reduce((sum, val) => sum + val, 0) / windowSize);
    }
    
    const mean = windows.reduce((sum, val) => sum + val, 0) / windows.length;
    const variance = windows.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windows.length;
    const stabilityIndex = Math.max(0, 1 - Math.sqrt(variance));

    // Determine trend direction
    const firstHalf = history.slice(0, Math.floor(totalSamples / 2));
    const secondHalf = history.slice(Math.floor(totalSamples / 2));
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    const trendThreshold = 0.05;
    if (secondHalfAvg - firstHalfAvg > trendThreshold) {
      trendDirection = 'improving';
    } else if (firstHalfAvg - secondHalfAvg > trendThreshold) {
      trendDirection = 'declining';
    }

    // Simplified precision/recall calculation (assumes threshold-based classification)
    const precision = this.estimatePrecision(acceptanceRate, threshold.adaptedThreshold);
    const recall = this.estimateRecall(acceptanceRate, threshold.adaptedThreshold);
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      acceptanceRate,
      precision,
      recall,
      f1Score,
      stabilityIndex,
      trendDirection,
      recentPerformance,
      sampleSize: totalSamples
    };
  }

  private shouldCalibrateThreshold(metrics: ThresholdPerformanceMetrics): boolean {
    // Calibrate if performance is poor, unstable, or trending down
    return (
      metrics.acceptanceRate < 0.3 ||  // Too few acceptances
      metrics.acceptanceRate > 0.9 ||  // Too many acceptances (threshold too low)
      metrics.stabilityIndex < 0.6 ||  // Unstable performance
      metrics.trendDirection === 'declining' ||
      metrics.f1Score < 0.5 ||
      metrics.sampleSize < 10  // Need more data
    );
  }

  private calculateCalibrationConfidence(metrics: ThresholdPerformanceMetrics): number {
    let confidence = 0.5;

    // Higher confidence with more samples
    confidence += Math.min(0.3, metrics.sampleSize / 100);

    // Higher confidence with stable performance
    confidence += metrics.stabilityIndex * 0.3;

    // Lower confidence with poor performance
    if (metrics.f1Score < 0.4) confidence -= 0.2;
    if (metrics.acceptanceRate < 0.2 || metrics.acceptanceRate > 0.95) confidence -= 0.2;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private calculateStatisticalSignificance(history: number[]): number {
    if (history.length < 10) return 0;

    // Simple z-test for proportion
    const n = history.length;
    const p = history.reduce((sum, val) => sum + val, 0) / n;
    const standardError = Math.sqrt((p * (1 - p)) / n);
    
    // Calculate z-score for difference from expected 0.5
    const zScore = Math.abs(p - 0.5) / standardError;
    
    // Convert to significance level (simplified)
    return Math.min(1.0, zScore / 2.58); // 2.58 is z-critical for 99% confidence
  }

  private calculateRecommendedRange(metrics: ThresholdPerformanceMetrics): [number, number] {
    const currentOptimal = this.estimateOptimalThreshold(metrics);
    const uncertainty = 1 - metrics.stabilityIndex;
    const range = uncertainty * 0.2; // Max 20% range

    return [
      Math.max(0.1, currentOptimal - range),
      Math.min(1.0, currentOptimal + range)
    ];
  }

  private estimateOptimalThreshold(metrics: ThresholdPerformanceMetrics): number {
    // Use F1 score to estimate optimal threshold
    // This is a simplified heuristic - in practice, you'd use ROC analysis
    
    if (metrics.f1Score > 0.7) {
      return 0.5; // Current threshold seems good
    }
    
    if (metrics.acceptanceRate < 0.3) {
      return 0.4; // Lower threshold to get more suggestions
    }
    
    if (metrics.acceptanceRate > 0.8) {
      return 0.7; // Raise threshold to improve quality
    }
    
    return 0.5;
  }

  private estimatePrecision(acceptanceRate: number, threshold: number): number {
    // Simplified precision estimation based on acceptance rate and threshold
    // Higher threshold generally means higher precision
    return Math.min(1.0, threshold + (acceptanceRate * 0.3));
  }

  private estimateRecall(acceptanceRate: number, threshold: number): number {
    // Simplified recall estimation
    // Lower threshold generally means higher recall
    return Math.min(1.0, (1 - threshold) + (acceptanceRate * 0.3));
  }

  private generateCalibrationAction(
    threshold: AdaptiveThreshold, 
    validation: ThresholdValidationResult
  ): CalibrationAction {
    const metrics = validation.performance;
    let newThreshold = threshold.adaptedThreshold;
    let reason = '';

    if (metrics.acceptanceRate < 0.3) {
      newThreshold = Math.max(0.1, threshold.adaptedThreshold - 0.1);
      reason = 'Low acceptance rate - reducing threshold';
    } else if (metrics.acceptanceRate > 0.9) {
      newThreshold = Math.min(1.0, threshold.adaptedThreshold + 0.15);
      reason = 'High acceptance rate - increasing threshold for quality';
    } else if (metrics.trendDirection === 'declining') {
      newThreshold = Math.max(0.1, threshold.adaptedThreshold - 0.05);
      reason = 'Declining performance trend - slight threshold reduction';
    } else if (metrics.stabilityIndex < 0.6) {
      // Move toward base threshold for stability
      const adjustment = (threshold.baseThreshold - threshold.adaptedThreshold) * 0.3;
      newThreshold = threshold.adaptedThreshold + adjustment;
      reason = 'Unstable performance - moving toward base threshold';
    } else if (metrics.sampleSize < 10) {
      // Reset to base threshold with insufficient data
      newThreshold = threshold.baseThreshold;
      reason = 'Insufficient data - resetting to base threshold';
    }

    return {
      domain: threshold.domain,
      entityType: threshold.entityType,
      oldThreshold: threshold.adaptedThreshold,
      newThreshold,
      reason,
      confidence: validation.calibrationConfidence,
      expectedImprovement: this.calculateExpectedImprovement(threshold, newThreshold),
      timestamp: new Date()
    };
  }

  private calculateExpectedImprovement(
    threshold: AdaptiveThreshold, 
    newThreshold: number
  ): number {
    // Estimate expected improvement based on threshold change
    const change = Math.abs(newThreshold - threshold.adaptedThreshold);
    const currentPerformance = threshold.performanceHistory.length > 0 
      ? threshold.performanceHistory.reduce((sum, val) => sum + val, 0) / threshold.performanceHistory.length
      : 0.5;

    // Larger changes with poor current performance have higher expected improvement
    const improvementPotential = (1 - currentPerformance) * change * 2;
    
    return Math.min(0.5, improvementPotential); // Cap at 50% improvement
  }

  private applyCalibrationAction(action: CalibrationAction): void {
    const thresholdKey = `${action.domain}_${action.entityType}`;
    const threshold = this.adaptiveThresholds.get(thresholdKey);

    if (threshold) {
      threshold.adaptedThreshold = action.newThreshold;
      threshold.lastAdjustment = action.timestamp;
      threshold.adjustmentReason = action.reason;
      
      this.adaptiveThresholds.set(thresholdKey, threshold);

      logger.info("Threshold calibrated", {
        domain: action.domain,
        entityType: action.entityType,
        oldThreshold: action.oldThreshold,
        newThreshold: action.newThreshold,
        reason: action.reason,
        confidence: action.confidence
      });
    }
  }

  private calculateAveragePerformance(): number {
    let totalPerformance = 0;
    let totalSamples = 0;

    for (const threshold of this.adaptiveThresholds.values()) {
      if (threshold.performanceHistory.length > 0) {
        const performance = threshold.performanceHistory.reduce((sum, val) => sum + val, 0) 
          / threshold.performanceHistory.length;
        totalPerformance += performance;
        totalSamples++;
      }
    }

    return totalSamples > 0 ? totalPerformance / totalSamples : 0.5;
  }

  // Generate performance report for domain thresholds
  generatePerformanceReport(): DomainThresholdReport {
    const domainStats: Record<string, DomainStatistics> = {};
    const globalStats = {
      totalThresholds: this.adaptiveThresholds.size,
      avgPerformance: this.calculateAveragePerformance(),
      calibrationRate: 0,
      topPerformingDomains: [] as string[],
      underperformingDomains: [] as string[]
    };

    for (const [key, threshold] of this.adaptiveThresholds.entries()) {
      const domain = threshold.domain;
      
      if (!domainStats[domain]) {
        domainStats[domain] = {
          domain,
          thresholdCount: 0,
          avgPerformance: 0,
          totalSamples: 0,
          lastCalibration: threshold.lastAdjustment,
          entityTypes: []
        };
      }

      const metrics = this.calculateThresholdMetrics(threshold);
      domainStats[domain]!.thresholdCount++;
      domainStats[domain]!.avgPerformance += metrics.acceptanceRate;
      domainStats[domain]!.totalSamples += metrics.sampleSize;
      domainStats[domain]!.entityTypes.push({
        entityType: threshold.entityType,
        threshold: threshold.adaptedThreshold,
        performance: metrics.acceptanceRate,
        sampleSize: metrics.sampleSize
      });
    }

    // Calculate averages and identify top/bottom performers
    const domainPerformances: Array<{ domain: string; performance: number }> = [];
    
    for (const stats of Object.values(domainStats)) {
      stats.avgPerformance /= stats.thresholdCount;
      domainPerformances.push({ domain: stats.domain, performance: stats.avgPerformance });
    }

    domainPerformances.sort((a, b) => b.performance - a.performance);
    globalStats.topPerformingDomains = domainPerformances.slice(0, 3).map(d => d.domain);
    globalStats.underperformingDomains = domainPerformances.slice(-3).map(d => d.domain);

    return {
      domainStats,
      globalStats,
      generatedAt: new Date(),
      recommendations: this.generateRecommendations(domainStats)
    };
  }

  private generateRecommendations(domainStats: Record<string, DomainStatistics>): string[] {
    const recommendations: string[] = [];

    for (const [domain, stats] of Object.entries(domainStats)) {
      if (stats.avgPerformance < 0.4) {
        recommendations.push(
          `Domain '${domain}' has low performance (${(stats.avgPerformance * 100).toFixed(1)}%). ` +
          `Consider reviewing threshold settings or entity detection patterns.`
        );
      }

      if (stats.totalSamples < 50) {
        recommendations.push(
          `Domain '${domain}' has insufficient data (${stats.totalSamples} samples). ` +
          `Increase usage or extend data collection period.`
        );
      }

      // Check for entity type imbalances
      const entityPerformances = stats.entityTypes.map(et => et.performance);
      const maxPerf = Math.max(...entityPerformances);
      const minPerf = Math.min(...entityPerformances);
      
      if (maxPerf - minPerf > 0.3 && stats.entityTypes.length > 1) {
        recommendations.push(
          `Domain '${domain}' has inconsistent performance across entity types. ` +
          `Consider entity-specific threshold tuning.`
        );
      }
    }

    return recommendations;
  }
}

// Additional interfaces for threshold validation
interface ThresholdValidationResult {
  domain: string;
  entityType: string;
  currentThreshold: number;
  baseThreshold: number;
  performance: ThresholdPerformanceMetrics;
  needsCalibration: boolean;
  calibrationConfidence: number;
  lastValidation: Date;
  statisticalSignificance: number;
  recommendedRange: [number, number];
}

interface ThresholdPerformanceMetrics {
  acceptanceRate: number;
  precision: number;
  recall: number;
  f1Score: number;
  stabilityIndex: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  recentPerformance: number;
  sampleSize: number;
}

interface CalibrationAction {
  domain: string;
  entityType: string;
  oldThreshold: number;
  newThreshold: number;
  reason: string;
  confidence: number;
  expectedImprovement: number;
  timestamp: Date;
}

interface DomainThresholdReport {
  domainStats: Record<string, DomainStatistics>;
  globalStats: {
    totalThresholds: number;
    avgPerformance: number;
    calibrationRate: number;
    topPerformingDomains: string[];
    underperformingDomains: string[];
  };
  generatedAt: Date;
  recommendations: string[];
}

interface DomainStatistics {
  domain: string;
  thresholdCount: number;
  avgPerformance: number;
  totalSamples: number;
  lastCalibration: Date;
  entityTypes: Array<{
    entityType: string;
    threshold: number;
    performance: number;
    sampleSize: number;
  }>;
}

export const adaptiveDomainService = new AdaptiveDomainService();
