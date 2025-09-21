import type { ReplacementSuggestion } from "./suggestionService.js";
import { scoringService, type UserFeedback } from "./scoringService.js";
import { adaptiveDomainService, type DomainContext } from "./adaptiveDomainService.js";
import { logger } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";

export interface FeedbackEvent {
  id: string;
  suggestionId: string;
  userId?: string | undefined;
  action: 'accept' | 'reject' | 'modify' | 'ignore' | 'undo';
  timestamp: Date;
  suggestion: ReplacementSuggestion;
  modifiedText?: string | undefined; // If user modified the suggestion
  sessionId?: string | undefined;
  contentTypeUid?: string | undefined;
  entryUid?: string | undefined;
  confidenceAtTime: number;
  relevanceScoreAtTime: number;
  metadata?: Record<string, any> | undefined;
}

export interface LearningInsights {
  userPatterns: {
    userId: string;
    preferredSources: string[];
    acceptanceRateByEntityType: Record<string, number>;
    averageConfidenceAccepted: number;
    commonRejectionReasons: string[];
  }[];
  globalPatterns: {
    overallAcceptanceRate: number;
    bestPerformingSources: string[];
    worstPerformingEntityTypes: string[];
    optimalConfidenceRange: [number, number];
    timeBasedTrends: Record<string, number>;
  };
  domainInsights: Record<string, {
    acceptanceRate: number;
    preferredSuggestionTypes: string[];
    averageUserSatisfaction: number;
  }>;
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    expectedImprovement: number;
  }[];
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confidenceCalibration: number;
  userSatisfaction: number;
  responseTime: number;
  lastUpdated: Date;
}

class FeedbackLearningService {
  private feedbackHistory: Map<string, FeedbackEvent[]> = new Map();
  private userProfiles: Map<string, any> = new Map();
  private globalStats: Map<string, any> = new Map();
  private modelPerformance: ModelPerformance[] = [];
  private learningQueue: FeedbackEvent[] = [];
  private isProcessing = false;

  constructor() {
    this.initializeService();
    this.startBackgroundProcessing();
  }

  /**
   * Record user feedback and trigger learning updates
   */
  async recordFeedback(feedback: {
    suggestionId: string;
    userId?: string;
    action: 'accept' | 'reject' | 'modify' | 'ignore' | 'undo';
    suggestion: ReplacementSuggestion;
    modifiedText?: string;
    sessionId?: string;
    contentTypeUid?: string;
    entryUid?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const feedbackEvent: FeedbackEvent = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      suggestionId: feedback.suggestionId,
      userId: feedback.userId,
      action: feedback.action,
      timestamp: new Date(),
      suggestion: feedback.suggestion,
      modifiedText: feedback.modifiedText,
      sessionId: feedback.sessionId,
      contentTypeUid: feedback.contentTypeUid,
      entryUid: feedback.entryUid,
      confidenceAtTime: feedback.suggestion.confidence,
      relevanceScoreAtTime: feedback.suggestion.relevanceScore || 0,
      metadata: feedback.metadata
    };

    // Store feedback
    const userId = feedback.userId || 'anonymous';
    if (!this.feedbackHistory.has(userId)) {
      this.feedbackHistory.set(userId, []);
    }
    this.feedbackHistory.get(userId)!.push(feedbackEvent);

    // Add to learning queue for processing
    this.learningQueue.push(feedbackEvent);

    // Immediate scoring service update
    const userFeedback: UserFeedback = {
      suggestionId: feedback.suggestionId,
      accepted: feedback.action === 'accept',
      timestamp: new Date(),
      userId: feedback.userId,
      contentType: feedback.contentTypeUid,
      entityType: feedback.suggestion.entity.type,
      confidence: feedback.suggestion.confidence,
      relevanceScore: feedback.suggestion.relevanceScore || 0
    };
    
    scoringService.recordFeedback(userFeedback);

    // Domain service update
    if (feedback.suggestion.domainContext) {
      adaptiveDomainService.learnFromFeedback(
        userFeedback,
        feedback.suggestion,
        feedback.suggestion.domainContext
      );
    }

    logger.info("Feedback recorded and learning triggered", {
      feedbackId: feedbackEvent.id,
      userId: feedback.userId,
      action: feedback.action,
      entityType: feedback.suggestion.entity.type,
      confidence: feedback.suggestion.confidence
    });
  }

  /**
   * Get personalized insights for a specific user
   */
  getUserInsights(userId: string): any {
    const userFeedback = this.feedbackHistory.get(userId) || [];
    if (userFeedback.length === 0) {
      return { message: "No feedback data available", suggestions: [] };
    }

    const totalFeedback = userFeedback.length;
    const acceptedFeedback = userFeedback.filter(f => f.action === 'accept');
    const acceptanceRate = acceptedFeedback.length / totalFeedback;

    // Analyze preferences by source
    const sourcePreferences: Record<string, { total: number; accepted: number }> = {};
    userFeedback.forEach(f => {
      const source = f.suggestion.source || 'unknown';
      if (!sourcePreferences[source]) {
        sourcePreferences[source] = { total: 0, accepted: 0 };
      }
      sourcePreferences[source].total++;
      if (f.action === 'accept') {
        sourcePreferences[source].accepted++;
      }
    });

    // Analyze preferences by entity type
    const entityTypePreferences: Record<string, { total: number; accepted: number }> = {};
    userFeedback.forEach(f => {
      const entityType = f.suggestion.entity.type;
      if (!entityTypePreferences[entityType]) {
        entityTypePreferences[entityType] = { total: 0, accepted: 0 };
      }
      entityTypePreferences[entityType].total++;
      if (f.action === 'accept') {
        entityTypePreferences[entityType].accepted++;
      }
    });

    // Calculate optimal confidence range for user
    const acceptedConfidences = acceptedFeedback.map(f => f.confidenceAtTime);
    const rejectedConfidences = userFeedback
      .filter(f => f.action === 'reject')
      .map(f => f.confidenceAtTime);

    const avgAcceptedConfidence = acceptedConfidences.length > 0
      ? acceptedConfidences.reduce((sum, c) => sum + c, 0) / acceptedConfidences.length
      : 0;

    const avgRejectedConfidence = rejectedConfidences.length > 0
      ? rejectedConfidences.reduce((sum, c) => sum + c, 0) / rejectedConfidences.length
      : 0;

    // Generate personalized recommendations
    const recommendations: string[] = [];
    
    if (acceptanceRate < 0.3) {
      recommendations.push("Consider adjusting suggestion thresholds - acceptance rate is low");
    }
    
    if (avgAcceptedConfidence > 0.8) {
      recommendations.push("You prefer high-confidence suggestions - we can filter out lower confidence ones");
    }
    
    const preferredSource = Object.entries(sourcePreferences)
      .sort(([,a], [,b]) => (b.accepted/b.total) - (a.accepted/a.total))[0];
    
    if (preferredSource && preferredSource[1].total > 5) {
      recommendations.push(`You seem to prefer ${preferredSource[0]} suggestions - we can prioritize these`);
    }

    return {
      userId,
      totalFeedback,
      acceptanceRate,
      sourcePreferences,
      entityTypePreferences,
      avgAcceptedConfidence,
      avgRejectedConfidence,
      recommendations,
      lastActivity: userFeedback[userFeedback.length - 1]?.timestamp
    };
  }

  /**
   * Generate comprehensive learning insights across all users
   */
  generateLearningInsights(): LearningInsights {
    const allFeedback: FeedbackEvent[] = [];
    for (const userFeedback of this.feedbackHistory.values()) {
      allFeedback.push(...userFeedback);
    }

    if (allFeedback.length === 0) {
      return {
        userPatterns: [],
        globalPatterns: {
          overallAcceptanceRate: 0,
          bestPerformingSources: [],
          worstPerformingEntityTypes: [],
          optimalConfidenceRange: [0, 1],
          timeBasedTrends: {}
        },
        domainInsights: {},
        recommendations: []
      };
    }

    // Global patterns analysis
    const totalActions = allFeedback.length;
    const acceptedActions = allFeedback.filter(f => f.action === 'accept').length;
    const overallAcceptanceRate = acceptedActions / totalActions;

    // Source performance analysis
    const sourcePerformance: Record<string, { total: number; accepted: number }> = {};
    allFeedback.forEach(f => {
      const source = f.suggestion.source || 'unknown';
      if (!sourcePerformance[source]) {
        sourcePerformance[source] = { total: 0, accepted: 0 };
      }
      sourcePerformance[source].total++;
      if (f.action === 'accept') {
        sourcePerformance[source].accepted++;
      }
    });

    const bestPerformingSources = Object.entries(sourcePerformance)
      .filter(([, stats]) => stats.total >= 10) // Minimum sample size
      .sort(([, a], [, b]) => (b.accepted / b.total) - (a.accepted / a.total))
      .slice(0, 3)
      .map(([source]) => source);

    // Entity type performance analysis
    const entityTypePerformance: Record<string, { total: number; accepted: number }> = {};
    allFeedback.forEach(f => {
      const entityType = f.suggestion.entity.type;
      if (!entityTypePerformance[entityType]) {
        entityTypePerformance[entityType] = { total: 0, accepted: 0 };
      }
      entityTypePerformance[entityType].total++;
      if (f.action === 'accept') {
        entityTypePerformance[entityType].accepted++;
      }
    });

    const worstPerformingEntityTypes = Object.entries(entityTypePerformance)
      .filter(([, stats]) => stats.total >= 5)
      .sort(([, a], [, b]) => (a.accepted / a.total) - (b.accepted / b.total))
      .slice(0, 3)
      .map(([entityType]) => entityType);

    // Optimal confidence range calculation
    const acceptedConfidences = allFeedback
      .filter(f => f.action === 'accept')
      .map(f => f.confidenceAtTime)
      .sort((a, b) => a - b);

    const optimalConfidenceRange: [number, number] = acceptedConfidences.length > 0
      ? [
          acceptedConfidences[Math.floor(acceptedConfidences.length * 0.1)] || 0,
          acceptedConfidences[Math.floor(acceptedConfidences.length * 0.9)] || 1
        ]
      : [0, 1];

    // Time-based trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFeedback = allFeedback.filter(f => f.timestamp >= thirtyDaysAgo);
    const timeBasedTrends: Record<string, number> = {
      recentAcceptanceRate: recentFeedback.length > 0
        ? recentFeedback.filter(f => f.action === 'accept').length / recentFeedback.length
        : 0,
      trendDirection: 0 // Would calculate trend over time
    };

    // User patterns analysis
    const userPatterns = Array.from(this.feedbackHistory.entries())
      .filter(([, feedback]) => feedback.length >= 5) // Minimum feedback for analysis
      .map(([userId, feedback]) => {
        const userInsights = this.getUserInsights(userId);
        return {
          userId,
          preferredSources: Object.entries(userInsights.sourcePreferences)
            .sort(([, a], [, b]) => {
            const aStats = a as { total: number; accepted: number };
            const bStats = b as { total: number; accepted: number };
            return (bStats.accepted / bStats.total) - (aStats.accepted / aStats.total);
          })
            .slice(0, 2)
            .map(([source]) => source),
          acceptanceRateByEntityType: userInsights.entityTypePreferences,
          averageConfidenceAccepted: userInsights.avgAcceptedConfidence,
          commonRejectionReasons: [] // Would need to analyze rejection patterns
        };
      });

    // Domain insights
    const domainInsights: Record<string, any> = {};
    // Group by domain and calculate insights
    const domainFeedback: Record<string, FeedbackEvent[]> = {};
    allFeedback.forEach(f => {
      const domain = f.suggestion.domainContext?.industry || 'general';
      if (!domainFeedback[domain]) {
        domainFeedback[domain] = [];
      }
      domainFeedback[domain].push(f);
    });

    Object.entries(domainFeedback).forEach(([domain, feedback]) => {
      const acceptanceRate = feedback.filter(f => f.action === 'accept').length / feedback.length;
      domainInsights[domain] = {
        acceptanceRate,
        preferredSuggestionTypes: [],
        averageUserSatisfaction: acceptanceRate // Simplified metric
      };
    });

    // Generate recommendations
    const recommendations: LearningInsights['recommendations'] = [];

    if (overallAcceptanceRate < 0.4) {
      recommendations.push({
        priority: 'high',
        action: 'Adjust confidence thresholds and improve suggestion quality',
        reason: `Overall acceptance rate is low (${(overallAcceptanceRate * 100).toFixed(1)}%)`,
        expectedImprovement: 0.2
      });
    }

    if (worstPerformingEntityTypes.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: `Improve suggestions for entity types: ${worstPerformingEntityTypes.join(', ')}`,
        reason: 'These entity types have low acceptance rates',
        expectedImprovement: 0.15
      });
    }

    if (bestPerformingSources.length > 0) {
      recommendations.push({
        priority: 'low',
        action: `Increase weight for high-performing sources: ${bestPerformingSources.join(', ')}`,
        reason: 'These sources consistently produce accepted suggestions',
        expectedImprovement: 0.1
      });
    }

    return {
      userPatterns,
      globalPatterns: {
        overallAcceptanceRate,
        bestPerformingSources,
        worstPerformingEntityTypes,
        optimalConfidenceRange,
        timeBasedTrends
      },
      domainInsights,
      recommendations
    };
  }

  /**
   * Get current model performance metrics
   */
  getCurrentPerformance(): ModelPerformance {
    const allFeedback: FeedbackEvent[] = [];
    for (const userFeedback of this.feedbackHistory.values()) {
      allFeedback.push(...userFeedback);
    }

    if (allFeedback.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        confidenceCalibration: 0,
        userSatisfaction: 0,
        responseTime: 0,
        lastUpdated: new Date()
      };
    }

    const totalActions = allFeedback.length;
    const acceptedActions = allFeedback.filter(f => f.action === 'accept').length;
    const accuracy = acceptedActions / totalActions;

    // Simplified metrics - in a real system these would be more sophisticated
    const precision = accuracy; // Simplified
    const recall = accuracy; // Simplified
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    // Confidence calibration: how well does our confidence predict acceptance
    const highConfidenceFeedback = allFeedback.filter(f => f.confidenceAtTime > 0.8);
    const highConfidenceAcceptanceRate = highConfidenceFeedback.length > 0
      ? highConfidenceFeedback.filter(f => f.action === 'accept').length / highConfidenceFeedback.length
      : 0;
    const confidenceCalibration = Math.abs(0.8 - highConfidenceAcceptanceRate); // How close to expected

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      confidenceCalibration: 1 - confidenceCalibration, // Invert so higher is better
      userSatisfaction: accuracy, // Simplified metric
      responseTime: 0, // Would need to track this separately
      lastUpdated: new Date()
    };
  }

  /**
   * Export learning data for analysis
   */
  async exportLearningData(): Promise<string> {
    const dataDir = path.join(process.cwd(), 'data', 'learning');
    await fs.mkdir(dataDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `learning_data_${timestamp}.json`;
    const filepath = path.join(dataDir, filename);

    const exportData = {
      feedbackHistory: Array.from(this.feedbackHistory.entries()),
      userProfiles: Array.from(this.userProfiles.entries()),
      globalStats: Array.from(this.globalStats.entries()),
      modelPerformance: this.modelPerformance,
      insights: this.generateLearningInsights(),
      exportedAt: new Date()
    };

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    
    logger.info("Learning data exported", { filepath });
    return filepath;
  }

  /**
   * Apply learned optimizations to suggestion configuration
   */
  async applyLearnings(): Promise<{
    applied: string[];
    skipped: string[];
    errors: string[];
  }> {
    const insights = this.generateLearningInsights();
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
      // Apply high-priority recommendations automatically
      for (const recommendation of insights.recommendations) {
        if (recommendation.priority === 'high' && recommendation.expectedImprovement > 0.1) {
          // In a real system, this would update configuration files or database
          logger.info("Applying high-priority learning", {
            action: recommendation.action,
            reason: recommendation.reason,
            expectedImprovement: recommendation.expectedImprovement
          });
          applied.push(recommendation.action);
        } else {
          skipped.push(recommendation.action);
        }
      }

      // Update user profiles based on feedback patterns
      for (const userPattern of insights.userPatterns) {
        this.userProfiles.set(userPattern.userId, {
          preferredSources: userPattern.preferredSources,
          averageConfidenceAccepted: userPattern.averageConfidenceAccepted,
          lastUpdated: new Date()
        });
      }

    } catch (error: any) {
      errors.push(`Failed to apply learnings: ${error.message}`);
      logger.error("Error applying learnings", { error: error.message });
    }

    return { applied, skipped, errors };
  }

  // Private methods

  private async initializeService(): Promise<void> {
    try {
      // Load existing feedback data if available
      await this.loadHistoricalData();
      logger.info("Feedback learning service initialized");
    } catch (error: any) {
      logger.warn("Could not load historical feedback data", { error: error.message });
    }
  }

  private async loadHistoricalData(): Promise<void> {
    const dataDir = path.join(process.cwd(), 'data', 'learning');
    
    try {
      const files = await fs.readdir(dataDir);
      const latestFile = files
        .filter(f => f.startsWith('learning_data_') && f.endsWith('.json'))
        .sort()
        .pop();

      if (latestFile) {
        const filepath = path.join(dataDir, latestFile);
        const data = JSON.parse(await fs.readFile(filepath, 'utf-8'));
        
        // Restore feedback history
        if (data.feedbackHistory) {
          this.feedbackHistory = new Map(data.feedbackHistory);
        }
        
        // Restore user profiles
        if (data.userProfiles) {
          this.userProfiles = new Map(data.userProfiles);
        }

        logger.info("Historical learning data loaded", { 
          feedbackEvents: Array.from(this.feedbackHistory.values()).flat().length,
          userProfiles: this.userProfiles.size
        });
      }
    } catch (error: any) {
      // File doesn't exist or is invalid - start fresh
      logger.debug("No valid historical data found, starting fresh");
    }
  }

  private startBackgroundProcessing(): void {
    // Process learning queue every 30 seconds
    setInterval(() => {
      if (!this.isProcessing && this.learningQueue.length > 0) {
        this.processLearningQueue();
      }
    }, 30000);

    // Update model performance every 5 minutes
    setInterval(() => {
      const currentPerformance = this.getCurrentPerformance();
      this.modelPerformance.push(currentPerformance);
      
      // Keep only last 100 performance records
      if (this.modelPerformance.length > 100) {
        this.modelPerformance = this.modelPerformance.slice(-100);
      }
    }, 5 * 60 * 1000);

    // Auto-apply learnings every hour
    setInterval(() => {
      this.applyLearnings();
    }, 60 * 60 * 1000);
  }

  private async processLearningQueue(): Promise<void> {
    if (this.isProcessing || this.learningQueue.length === 0) return;

    this.isProcessing = true;
    const batchSize = Math.min(50, this.learningQueue.length);
    const batch = this.learningQueue.splice(0, batchSize);

    try {
      // Process feedback events in batch
      for (const event of batch) {
        // Update global statistics
        this.updateGlobalStats(event);
        
        // Update user profiles
        this.updateUserProfile(event);
      }

      logger.info("Learning batch processed", { batchSize });
    } catch (error: any) {
      logger.error("Error processing learning batch", { error: error.message, batchSize });
    } finally {
      this.isProcessing = false;
    }
  }

  private updateGlobalStats(event: FeedbackEvent): void {
    const statsKey = `${event.suggestion.entity.type}_${event.suggestion.source}`;
    const currentStats = this.globalStats.get(statsKey) || { total: 0, accepted: 0 };
    
    currentStats.total++;
    if (event.action === 'accept') {
      currentStats.accepted++;
    }
    
    this.globalStats.set(statsKey, currentStats);
  }

  private updateUserProfile(event: FeedbackEvent): void {
    if (!event.userId) return;

    const profile = this.userProfiles.get(event.userId) || {
      totalFeedback: 0,
      acceptanceRate: 0,
      preferredSources: [],
      lastActivity: new Date()
    };

    profile.totalFeedback++;
    profile.lastActivity = event.timestamp;
    
    // Update acceptance rate (running average)
    const isAccepted = event.action === 'accept' ? 1 : 0;
    profile.acceptanceRate = (profile.acceptanceRate * (profile.totalFeedback - 1) + isAccepted) / profile.totalFeedback;

    this.userProfiles.set(event.userId, profile);
  }
}

export const feedbackLearningService = new FeedbackLearningService();
