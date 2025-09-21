import type { ReplacementSuggestion } from "./suggestionService.js";
import type { NamedEntity } from "./nerService.js";
import { logger } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";

export interface TestCase {
  id: string;
  name: string;
  description: string;
  input: {
    text: string;
    context?: {
      contentTypeUid?: string;
      entryUid?: string;
      replacementRule?: {
        find: string;
        replace: string;
        mode?: string;
      };
      preferredBrands?: string[];
    };
  };
  expected: {
    minSuggestions: number;
    maxSuggestions: number;
    requiredEntityTypes?: NamedEntity['type'][];
    expectedConfidenceRange?: [number, number];
    mustContain?: string[];
    mustNotContain?: string[];
    sourceDistribution?: Record<string, number>;
  };
  metadata: {
    domain: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    createdAt: Date;
    lastRun?: Date;
  };
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  score: number;
  suggestions: ReplacementSuggestion[];
  metrics: {
    suggestionCount: number;
    averageConfidence: number;
    sourceBreakdown: Record<string, number>;
    entityTypeBreakdown: Record<string, number>;
    processingTime: number;
  };
  failures: string[];
  warnings: string[];
  timestamp: Date;
}

export interface ValidationReport {
  testSuiteId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallScore: number;
  averageProcessingTime: number;
  domainPerformance: Record<string, number>;
  sourcePerformance: Record<string, number>;
  recommendations: string[];
  timestamp: Date;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  suggestionAccuracy: number;
  userAcceptanceRate: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
}

class ValidationFramework {
  private testCases: Map<string, TestCase> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private validationRules: Map<string, Function> = new Map();

  constructor() {
    this.initializeDefaultTestCases();
    this.setupValidationRules();
  }

  /**
   * Run comprehensive validation test suite
   */
  async runValidationSuite(
    suggestionFunction: Function,
    options?: {
      suiteId?: string;
      domains?: string[];
      difficulty?: ('easy' | 'medium' | 'hard')[];
      parallel?: boolean;
      timeout?: number;
    }
  ): Promise<ValidationReport> {
    const suiteId = options?.suiteId || `validation_${Date.now()}`;
    const startTime = Date.now();

    logger.info("Starting validation suite", {
      suiteId,
      totalTestCases: this.testCases.size,
      options
    });

    // Filter test cases based on options
    const testCasesToRun = this.filterTestCases(options);
    const results: TestResult[] = [];

    if (options?.parallel) {
      // Run tests in parallel
      const promises = testCasesToRun.map(testCase =>
        this.runSingleTest(testCase, suggestionFunction, options?.timeout)
      );
      results.push(...await Promise.all(promises));
    } else {
      // Run tests sequentially
      for (const testCase of testCasesToRun) {
        const result = await this.runSingleTest(testCase, suggestionFunction, options?.timeout);
        results.push(result);
      }
    }

    // Generate comprehensive report
    const report = this.generateValidationReport(suiteId, results);
    
    // Store results for historical analysis
    this.storeTestResults(suiteId, results);
    
    const endTime = Date.now();
    logger.info("Validation suite completed", {
      suiteId,
      duration: endTime - startTime,
      passRate: (report.passedTests / report.totalTests * 100).toFixed(2) + '%',
      overallScore: report.overallScore
    });

    return report;
  }

  /**
   * Run A/B testing between two suggestion implementations
   */
  async runABTest(
    functionA: Function,
    functionB: Function,
    options?: {
      testCases?: string[];
      iterations?: number;
      confidenceLevel?: number;
    }
  ): Promise<{
    functionAScore: number;
    functionBScore: number;
    significantDifference: boolean;
    detailedResults: any;
  }> {
    const iterations = options?.iterations || 100;
    const testCases = options?.testCases || Array.from(this.testCases.keys());
    
    const resultsA: TestResult[] = [];
    const resultsB: TestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      for (const testCaseId of testCases) {
        const testCase = this.testCases.get(testCaseId);
        if (!testCase) continue;

        const [resultA, resultB] = await Promise.all([
          this.runSingleTest(testCase, functionA),
          this.runSingleTest(testCase, functionB)
        ]);

        resultsA.push(resultA);
        resultsB.push(resultB);
      }
    }

    // Calculate statistical significance
    const scoreA = resultsA.reduce((sum, r) => sum + r.score, 0) / resultsA.length;
    const scoreB = resultsB.reduce((sum, r) => sum + r.score, 0) / resultsB.length;
    
    const significantDifference = this.calculateStatisticalSignificance(
      resultsA.map(r => r.score),
      resultsB.map(r => r.score),
      options?.confidenceLevel || 0.95
    );

    return {
      functionAScore: scoreA,
      functionBScore: scoreB,
      significantDifference,
      detailedResults: {
        functionA: this.generateValidationReport('a_test', resultsA),
        functionB: this.generateValidationReport('b_test', resultsB)
      }
    };
  }

  /**
   * Real-world validation with live data
   */
  async validateRealWorldPerformance(
    suggestionFunction: Function,
    realWorldData: Array<{
      text: string;
      context?: any;
      expectedOutcomes?: any;
    }>
  ): Promise<{
    accuracy: number;
    performance: PerformanceMetrics;
    insights: string[];
  }> {
    const startTime = Date.now();
    let totalCorrect = 0;
    const performanceData: number[] = [];
    const insights: string[] = [];

    for (const data of realWorldData) {
      const testStartTime = Date.now();
      
      try {
        const suggestions = await suggestionFunction(data.text, data.context);
        const testEndTime = Date.now();
        
        performanceData.push(testEndTime - testStartTime);
        
        // Validate against expected outcomes if provided
        if (data.expectedOutcomes) {
          const isCorrect = this.validateExpectedOutcome(suggestions, data.expectedOutcomes);
          if (isCorrect) totalCorrect++;
        }

        // Generate insights from real-world patterns
        this.analyzeRealWorldPatterns(suggestions, data, insights);

      } catch (error) {
        logger.error("Real-world validation error", { error });
      }
    }

    const endTime = Date.now();
    const accuracy = realWorldData.length > 0 ? totalCorrect / realWorldData.length : 0;

    const performance: PerformanceMetrics = {
      averageResponseTime: performanceData.reduce((sum, time) => sum + time, 0) / performanceData.length,
      p95ResponseTime: this.calculatePercentile(performanceData, 95),
      p99ResponseTime: this.calculatePercentile(performanceData, 99),
      suggestionAccuracy: accuracy,
      userAcceptanceRate: 0, // Would need user feedback data
      errorRate: 0, // Would track errors
      cacheHitRate: 0, // Would need cache metrics
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };

    return { accuracy, performance, insights };
  }

  /**
   * Add custom test case
   */
  addTestCase(testCase: TestCase): void {
    this.testCases.set(testCase.id, testCase);
    logger.info("Test case added", { id: testCase.id, domain: testCase.metadata.domain });
  }

  /**
   * Generate test cases from real content
   */
  async generateTestCasesFromContent(
    content: Array<{
      text: string;
      context?: any;
      metadata?: any;
    }>,
    domain: string
  ): Promise<TestCase[]> {
    const generatedCases: TestCase[] = [];

    for (let i = 0; i < content.length; i++) {
      const item = content[i]!;
      const testCase: TestCase = {
        id: `generated_${domain}_${i}`,
        name: `Generated test for ${domain}`,
        description: `Auto-generated test case from real content`,
        input: {
          text: item.text,
          context: item.context
        },
        expected: {
          minSuggestions: 1,
          maxSuggestions: 10,
          expectedConfidenceRange: [0.3, 1.0]
        },
        metadata: {
          domain,
          difficulty: 'medium',
          tags: ['auto-generated'],
          createdAt: new Date()
        }
      };

      generatedCases.push(testCase);
      this.addTestCase(testCase);
    }

    logger.info("Generated test cases from content", {
      domain,
      count: generatedCases.length
    });

    return generatedCases;
  }

  /**
   * Export test results for analysis
   */
  async exportResults(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
    const dataDir = path.join(process.cwd(), 'data', 'validation');
    await fs.mkdir(dataDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `validation_results_${timestamp}.${format}`;
    const filepath = path.join(dataDir, filename);

    const exportData = {
      testCases: Array.from(this.testCases.values()),
      results: Array.from(this.testResults.entries()),
      performanceHistory: this.performanceHistory,
      exportedAt: new Date()
    };

    switch (format) {
      case 'json':
        await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
        break;
      case 'csv':
        const csvData = this.convertToCSV(exportData);
        await fs.writeFile(filepath, csvData);
        break;
      case 'html':
        const htmlData = this.generateHTMLReport(exportData);
        await fs.writeFile(filepath, htmlData);
        break;
    }

    logger.info("Validation results exported", { filepath, format });
    return filepath;
  }

  // Private methods

  private async runSingleTest(
    testCase: TestCase,
    suggestionFunction: Function,
    timeout?: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Set up timeout if specified
      const suggestions = timeout
        ? await Promise.race([
            suggestionFunction(testCase.input.text, testCase.input.context),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Test timeout')), timeout)
            )
          ])
        : await suggestionFunction(testCase.input.text, testCase.input.context);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Validate results against expectations
      const { passed, score, failures, warnings } = this.validateTestResult(
        suggestions,
        testCase.expected
      );

      // Calculate metrics
      const metrics = this.calculateTestMetrics(suggestions, processingTime);

      const result: TestResult = {
        testCaseId: testCase.id,
        passed,
        score,
        suggestions,
        metrics,
        failures,
        warnings,
        timestamp: new Date()
      };

      testCase.metadata.lastRun = new Date();
      return result;

    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        testCaseId: testCase.id,
        passed: false,
        score: 0,
        suggestions: [],
        metrics: {
          suggestionCount: 0,
          averageConfidence: 0,
          sourceBreakdown: {},
          entityTypeBreakdown: {},
          processingTime: endTime - startTime
        },
        failures: [`Test execution failed: ${error.message}`],
        warnings: [],
        timestamp: new Date()
      };
    }
  }

  private validateTestResult(
    suggestions: ReplacementSuggestion[],
    expected: TestCase['expected']
  ): { passed: boolean; score: number; failures: string[]; warnings: string[] } {
    const failures: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check suggestion count
    if (suggestions.length < expected.minSuggestions) {
      failures.push(`Too few suggestions: ${suggestions.length} < ${expected.minSuggestions}`);
      score -= 20;
    }
    
    if (suggestions.length > expected.maxSuggestions) {
      warnings.push(`Too many suggestions: ${suggestions.length} > ${expected.maxSuggestions}`);
      score -= 5;
    }

    // Check confidence range
    if (expected.expectedConfidenceRange) {
      const [minConf, maxConf] = expected.expectedConfidenceRange;
      const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
      
      if (avgConfidence < minConf || avgConfidence > maxConf) {
        failures.push(`Average confidence ${avgConfidence.toFixed(2)} outside expected range [${minConf}, ${maxConf}]`);
        score -= 15;
      }
    }

    // Check required entity types
    if (expected.requiredEntityTypes) {
      const presentEntityTypes = new Set(suggestions.map(s => s.entity.type));
      const missingTypes = expected.requiredEntityTypes.filter(type => !presentEntityTypes.has(type));
      
      if (missingTypes.length > 0) {
        failures.push(`Missing required entity types: ${missingTypes.join(', ')}`);
        score -= 10 * missingTypes.length;
      }
    }

    // Check must contain/not contain
    if (expected.mustContain) {
      const allSuggestionText = suggestions.map(s => s.suggestedReplacement).join(' ').toLowerCase();
      const missingRequired = expected.mustContain.filter(text => !allSuggestionText.includes(text.toLowerCase()));
      
      if (missingRequired.length > 0) {
        failures.push(`Missing required content: ${missingRequired.join(', ')}`);
        score -= 15;
      }
    }

    if (expected.mustNotContain) {
      const allSuggestionText = suggestions.map(s => s.suggestedReplacement).join(' ').toLowerCase();
      const forbiddenPresent = expected.mustNotContain.filter(text => allSuggestionText.includes(text.toLowerCase()));
      
      if (forbiddenPresent.length > 0) {
        failures.push(`Contains forbidden content: ${forbiddenPresent.join(', ')}`);
        score -= 20;
      }
    }

    const passed = failures.length === 0;
    const finalScore = Math.max(0, Math.min(100, score));

    return { passed, score: finalScore, failures, warnings };
  }

  private calculateTestMetrics(
    suggestions: ReplacementSuggestion[],
    processingTime: number
  ): TestResult['metrics'] {
    const sourceBreakdown: Record<string, number> = {};
    const entityTypeBreakdown: Record<string, number> = {};

    suggestions.forEach(suggestion => {
      const source = suggestion.source || 'unknown';
      const entityType = suggestion.entity.type;

      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
      entityTypeBreakdown[entityType] = (entityTypeBreakdown[entityType] || 0) + 1;
    });

    const averageConfidence = suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
      : 0;

    return {
      suggestionCount: suggestions.length,
      averageConfidence,
      sourceBreakdown,
      entityTypeBreakdown,
      processingTime
    };
  }

  private filterTestCases(options?: {
    domains?: string[];
    difficulty?: ('easy' | 'medium' | 'hard')[];
  }): TestCase[] {
    let filtered = Array.from(this.testCases.values());

    if (options?.domains) {
      filtered = filtered.filter(tc => options.domains!.includes(tc.metadata.domain));
    }

    if (options?.difficulty) {
      filtered = filtered.filter(tc => options.difficulty!.includes(tc.metadata.difficulty));
    }

    return filtered;
  }

  private generateValidationReport(
    suiteId: string,
    results: TestResult[]
  ): ValidationReport {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const overallScore = results.reduce((sum, r) => sum + r.score, 0) / totalTests;
    const averageProcessingTime = results.reduce((sum, r) => sum + r.metrics.processingTime, 0) / totalTests;

    // Calculate domain performance
    const domainPerformance: Record<string, number> = {};
    const domainGroups = this.groupResultsByDomain(results);
    
    for (const [domain, domainResults] of Object.entries(domainGroups)) {
      const domainScore = domainResults.reduce((sum, r) => sum + r.score, 0) / domainResults.length;
      domainPerformance[domain] = domainScore;
    }

    // Calculate source performance
    const sourcePerformance: Record<string, number> = {};
    results.forEach(result => {
      Object.entries(result.metrics.sourceBreakdown).forEach(([source, count]) => {
        sourcePerformance[source] = (sourcePerformance[source] || 0) + count;
      });
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(results, domainPerformance);

    return {
      testSuiteId: suiteId,
      totalTests,
      passedTests,
      failedTests,
      overallScore,
      averageProcessingTime,
      domainPerformance,
      sourcePerformance,
      recommendations,
      timestamp: new Date()
    };
  }

  private generateRecommendations(
    results: TestResult[],
    domainPerformance: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    const slowTests = results.filter(r => r.metrics.processingTime > 5000);
    if (slowTests.length > 0) {
      recommendations.push(`Optimize performance: ${slowTests.length} tests took > 5 seconds`);
    }

    // Domain-specific recommendations
    for (const [domain, score] of Object.entries(domainPerformance)) {
      if (score < 70) {
        recommendations.push(`Improve ${domain} domain suggestions (current score: ${score.toFixed(1)})`);
      }
    }

    // Confidence recommendations
    const lowConfidenceResults = results.filter(r => r.metrics.averageConfidence < 0.5);
    if (lowConfidenceResults.length > results.length * 0.3) {
      recommendations.push("Consider adjusting confidence calculation - many suggestions have low confidence");
    }

    return recommendations;
  }

  private groupResultsByDomain(results: TestResult[]): Record<string, TestResult[]> {
    const groups: Record<string, TestResult[]> = {};
    
    results.forEach(result => {
      const testCase = this.testCases.get(result.testCaseId);
      if (testCase) {
        const domain = testCase.metadata.domain;
        if (!groups[domain]) groups[domain] = [];
        groups[domain]!.push(result);
      }
    });

    return groups;
  }

  private storeTestResults(suiteId: string, results: TestResult[]): void {
    this.testResults.set(suiteId, results);
    
    // Keep only last 10 test runs to prevent memory issues
    if (this.testResults.size > 10) {
      const oldestKey = Array.from(this.testResults.keys())[0];
      if (oldestKey) {
        this.testResults.delete(oldestKey);
      }
    }
  }

  private calculateStatisticalSignificance(
    dataA: number[],
    dataB: number[],
    confidenceLevel: number
  ): boolean {
    // Simple t-test implementation
    const meanA = dataA.reduce((sum, val) => sum + val, 0) / dataA.length;
    const meanB = dataB.reduce((sum, val) => sum + val, 0) / dataB.length;
    
    const varA = dataA.reduce((sum, val) => sum + Math.pow(val - meanA, 2), 0) / (dataA.length - 1);
    const varB = dataB.reduce((sum, val) => sum + Math.pow(val - meanB, 2), 0) / (dataB.length - 1);
    
    const standardError = Math.sqrt(varA / dataA.length + varB / dataB.length);
    const tStatistic = Math.abs(meanA - meanB) / standardError;
    
    // Simplified critical value for 95% confidence
    const criticalValue = confidenceLevel === 0.95 ? 1.96 : 2.58;
    
    return tStatistic > criticalValue;
  }

  private calculatePercentile(data: number[], percentile: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private validateExpectedOutcome(suggestions: ReplacementSuggestion[], expected: any): boolean {
    // Implementation would depend on the structure of expected outcomes
    return true; // Placeholder
  }

  private analyzeRealWorldPatterns(
    suggestions: ReplacementSuggestion[],
    data: any,
    insights: string[]
  ): void {
    // Analyze patterns and add insights
    if (suggestions.length === 0) {
      insights.push("No suggestions generated for real-world content - may indicate coverage gaps");
    }
    
    const highConfidenceSuggestions = suggestions.filter(s => s.confidence > 0.8);
    if (highConfidenceSuggestions.length / suggestions.length < 0.3) {
      insights.push("Low proportion of high-confidence suggestions in real-world data");
    }
  }

  private convertToCSV(data: any): string {
    // Implementation for CSV export
    return "CSV export not implemented yet";
  }

  private generateHTMLReport(data: any): string {
    // Implementation for HTML report generation
    return "<html><body><h1>Validation Report</h1><p>HTML report not implemented yet</p></body></html>";
  }

  private initializeDefaultTestCases(): void {
    // Add some default test cases for common scenarios
    const defaultCases: TestCase[] = [
      {
        id: 'basic_email_test',
        name: 'Basic Email Replacement',
        description: 'Test email address suggestions',
        input: {
          text: 'Contact us at old@example.com for support',
          context: { contentTypeUid: 'contact_page' }
        },
        expected: {
          minSuggestions: 1,
          maxSuggestions: 5,
          requiredEntityTypes: ['Email'],
          expectedConfidenceRange: [0.4, 1.0]
        },
        metadata: {
          domain: 'general',
          difficulty: 'easy',
          tags: ['email', 'contact'],
          createdAt: new Date()
        }
      },
      {
        id: 'version_update_test',
        name: 'Version Number Update',
        description: 'Test version increment suggestions',
        input: {
          text: 'Current version is 2.1.0 and will be updated soon',
          context: { contentTypeUid: 'product_page' }
        },
        expected: {
          minSuggestions: 1,
          maxSuggestions: 3,
          requiredEntityTypes: ['Version'],
          expectedConfidenceRange: [0.3, 0.8]
        },
        metadata: {
          domain: 'technology',
          difficulty: 'medium',
          tags: ['version', 'product'],
          createdAt: new Date()
        }
      }
    ];

    defaultCases.forEach(testCase => this.addTestCase(testCase));
  }

  private setupValidationRules(): void {
    // Setup custom validation rules
    this.validationRules.set('confidence_range', (suggestions: ReplacementSuggestion[], min: number, max: number) => {
      return suggestions.every((s: ReplacementSuggestion) => s.confidence >= min && s.confidence <= max);
    });

    this.validationRules.set('source_diversity', (suggestions: ReplacementSuggestion[], minSources: number) => {
      const sources = new Set(suggestions.map((s: ReplacementSuggestion) => s.source));
      return sources.size >= minSources;
    });
  }
}

export const validationFramework = new ValidationFramework();
