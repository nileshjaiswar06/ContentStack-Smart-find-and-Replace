import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";

const router = Router();

// Launch integration endpoints for hosting within Contentstack dashboard
// These endpoints serve the app UI and handle Contentstack Launch-specific requests

/**
 * GET /launch/app
 * Main app entry point for Contentstack Launch
 * This endpoint serves the app UI that will be embedded in the Contentstack dashboard
 */
router.get("/app", async (req: Request, res: Response) => {
  try {
    const { stack, environment, locale, entry_uid, content_type_uid } = req.query;
    
    logger.info("Launch app accessed", {
      stack,
      environment,
      locale,
      entry_uid,
      content_type_uid,
      user_agent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    // Return a simple HTML interface for the Launch app
    // In a real implementation, this would serve your React/Vue/Angular app
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Find & Replace - Contentstack Launch</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; 
            padding: 20px; 
            background: #f8f9fa;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 24px;
        }
        .header { 
            border-bottom: 1px solid #e9ecef; 
            padding-bottom: 16px; 
            margin-bottom: 24px;
        }
        .header h1 { 
            margin: 0; 
            color: #495057; 
            font-size: 24px;
        }
        .status { 
            background: #d4edda; 
            color: #155724; 
            padding: 12px; 
            border-radius: 4px; 
            margin-bottom: 20px;
        }
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 16px; 
            margin-bottom: 24px;
        }
        .info-card { 
            background: #f8f9fa; 
            padding: 16px; 
            border-radius: 6px; 
            border-left: 4px solid #007bff;
        }
        .info-card h3 { 
            margin: 0 0 8px 0; 
            color: #495057; 
            font-size: 14px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
        }
        .info-card p { 
            margin: 0; 
            color: #6c757d; 
            font-size: 16px; 
            font-weight: 500;
        }
        .actions { 
            display: flex; 
            gap: 12px; 
            flex-wrap: wrap;
        }
        .btn { 
            background: #007bff; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 4px; 
            cursor: pointer; 
            text-decoration: none; 
            display: inline-block;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        .btn:hover { 
            background: #0056b3; 
        }
        .btn-secondary { 
            background: #6c757d; 
        }
        .btn-secondary:hover { 
            background: #545b62; 
        }
        .btn-success { 
            background: #28a745; 
        }
        .btn-success:hover { 
            background: #1e7e34; 
        }
        .webhook-status { 
            background: #fff3cd; 
            color: #856404; 
            padding: 12px; 
            border-radius: 4px; 
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Smart Find & Replace</h1>
        </div>
        
        <div class="status">
            ✅ Launch integration active - Connected to Contentstack dashboard
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <h3>Stack</h3>
                <p>${stack || 'N/A'}</p>
            </div>
            <div class="info-card">
                <h3>Environment</h3>
                <p>${environment || 'N/A'}</p>
            </div>
            <div class="info-card">
                <h3>Locale</h3>
                <p>${locale || 'N/A'}</p>
            </div>
            <div class="info-card">
                <h3>Entry UID</h3>
                <p>${entry_uid || 'N/A'}</p>
            </div>
            <div class="info-card">
                <h3>Content Type</h3>
                <p>${content_type_uid || 'N/A'}</p>
            </div>
        </div>
        
        <div class="actions">
            <a href="/api/brandkit/config" class="btn" target="_blank">View Brandkit Config</a>
            <a href="/api/brandkit/sync" class="btn btn-success" target="_blank">Sync Brandkit Data</a>
            <a href="/api/brandkit/test-cda" class="btn btn-secondary" target="_blank">Test CDA Connection</a>
            <button onclick="refreshData()" class="btn">Refresh Data</button>
        </div>
        
        <div class="webhook-status">
            <strong>Real-time Updates:</strong> Webhook integration enabled for automatic brandkit sync when content changes.
        </div>
    </div>
    
    <script>
        function refreshData() {
            fetch('/api/brandkit/sync', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    alert('Brandkit data synced successfully!');
                    console.log('Sync result:', data);
                })
                .catch(error => {
                    alert('Sync failed: ' + error.message);
                    console.error('Sync error:', error);
                });
        }
        
        // Auto-refresh every 30 seconds to show real-time updates
        setInterval(() => {
            fetch('/api/brandkit/config')
                .then(response => response.json())
                .then(data => {
                    console.log('Brandkit config updated:', data);
                })
                .catch(error => {
                    console.error('Config fetch error:', error);
                });
        }, 30000);
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    logger.error("Launch app error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Failed to load Launch app",
      details: error.message 
    });
  }
});

/**
 * GET /launch/config
 * Configuration endpoint for Launch app
 * Returns app configuration and capabilities
 */
router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = {
      app: {
        name: "Smart Find & Replace",
        version: "1.0.0",
        description: "Context-aware find and replace with brandkit integration",
        capabilities: [
          "Contextual replacement",
          "Smart link updates", 
          "Named entity replacement",
          "Deep content coverage",
          "Brandkit integration",
          "Real-time sync"
        ]
      },
      integration: {
        launch: {
          supported: true,
          ui_embedded: true,
          entry_context: true
        },
        automate: {
          supported: true,
          webhook_triggers: true,
          real_time_sync: true
        },
        brandkit: {
          cda_integration: true,
          real_time_updates: true,
          content_types: ["brands", "banned_phrases", "tone_rules"]
        }
      },
      endpoints: {
        brandkit_sync: "/api/brandkit/sync",
        brandkit_config: "/api/brandkit/config",
        webhook_entry: "/api/webhooks/entry",
        webhook_asset: "/api/webhooks/asset",
        webhook_publish: "/api/webhooks/publish"
      }
    };

    res.json({ success: true, data: config });
  } catch (error: any) {
    logger.error("Launch config error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Failed to get Launch config",
      details: error.message 
    });
  }
});

/**
 * POST /launch/action
 * Handle actions from Launch app
 * This endpoint processes actions triggered from within the Contentstack dashboard
 */
router.post("/action", async (req: Request, res: Response) => {
  try {
    const { action, data } = req.body;
    const { stack, environment, entry_uid, content_type_uid } = req.query;
    
    logger.info("Launch action received", {
      action,
      stack,
      environment,
      entry_uid,
      content_type_uid,
      data: data ? Object.keys(data) : null
    });

    let result: any = { success: true };

    switch (action) {
      case 'sync_brandkit':
        // Trigger brandkit sync
        const syncResponse = await fetch(`${req.protocol}://${req.get('host')}/api/brandkit/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const syncData = await syncResponse.json();
        result = { success: true, action: 'sync_brandkit', data: syncData };
        break;
        
      case 'get_suggestions':
        // Get brandkit suggestions for current entry
        if (data?.text) {
          const suggestionsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/brandkit/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.text })
          });
          const suggestionsData = await suggestionsResponse.json();
          result = { success: true, action: 'get_suggestions', data: suggestionsData };
        } else {
          result = { success: false, error: 'No text provided for suggestions' };
        }
        break;
        
      case 'test_connection':
        // Test CDA connection
        const testResponse = await fetch(`${req.protocol}://${req.get('host')}/api/brandkit/test-cda`);
        const testData = await testResponse.json();
        result = { success: true, action: 'test_connection', data: testData };
        break;
        
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    res.json(result);
  } catch (error: any) {
    logger.error("Launch action error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Failed to process Launch action",
      details: error.message 
    });
  }
});

export default router;