/**
 * Simple Node.js server to test CDP tracking events
 *
 * This server receives tracking events from the CDP tracking system
 * and logs them to the console and to a file for inspection.
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const bodyParser = require("body-parser");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create log streams for different event types
const viewLogStream = fs.createWriteStream(
  path.join(logsDir, "view-events.log"),
  { flags: "a" }
);
const actionLogStream = fs.createWriteStream(
  path.join(logsDir, "action-events.log"),
  { flags: "a" }
);
const conversionLogStream = fs.createWriteStream(
  path.join(logsDir, "conversion-events.log"),
  { flags: "a" }
);
const feedbackLogStream = fs.createWriteStream(
  path.join(logsDir, "feedback-events.log"),
  { flags: "a" }
);
const profileLogStream = fs.createWriteStream(
  path.join(logsDir, "profile-updates.log"),
  { flags: "a" }
);
const allEventsLogStream = fs.createWriteStream(
  path.join(logsDir, "all-events.log"),
  { flags: "a" }
);

// Middleware
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow all methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow these headers
  })
); // Enable CORS for all routes
app.use(bodyParser.json({ limit: "1mb" })); // Parse JSON request bodies
app.use(morgan("combined")); // Log HTTP requests

// Helper function to log events
function logEvent(event, logStream) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${JSON.stringify(event)}\n\n`;

  console.log(
    `Received event: ${event.eventType || "profile"} - ${
      event.eventName || "update_profile"
    }`
  );

  // Log to specific event type log
  logStream.write(logEntry);

  // Also log to all events log
  allEventsLogStream.write(logEntry);
}

// Routes for different event types
app.post("/track/view", (req, res) => {
  const event = req.body;
  logEvent(event, viewLogStream);
  res.json({ success: true, message: "View event received" });
});

app.post("/track/action", (req, res) => {
  const event = req.body;
  logEvent(event, actionLogStream);
  res.json({ success: true, message: "Action event received" });
});

app.post("/track/conversion", (req, res) => {
  const event = req.body;
  logEvent(event, conversionLogStream);
  res.json({ success: true, message: "Conversion event received" });
});

app.post("/track/feedback", (req, res) => {
  const event = req.body;
  logEvent(event, feedbackLogStream);
  res.json({ success: true, message: "Feedback event received" });
});

app.post("/profile/update", (req, res) => {
  const event = req.body;
  logEvent(event, profileLogStream);
  res.json({ success: true, message: "Profile update received" });
});

// Fallback route for any other tracking endpoint
app.post("/track", (req, res) => {
  const event = req.body;
  logEvent(event, allEventsLogStream);
  res.json({ success: true, message: "Event received" });
});

// Serve tracking files
app.get("/client-integration.js", (req, res) => {
  res.sendFile(path.join(__dirname, "client-integration.js"));
});

app.get("/cdp-tracker.js", (req, res) => {
  res.sendFile(path.join(__dirname, "cdp-tracker.js"));
});

app.get("/tracker-iframe.html", (req, res) => {
  res.sendFile(path.join(__dirname, "tracker-iframe.html"));
});

// Serve test.html
app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "test.html"));
});

// Simple status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Serve a simple dashboard to view logs
app.get("/", (req, res) => {
  // Get event counts from log files
  let viewCount = 0;
  let actionCount = 0;
  let conversionCount = 0;
  let feedbackCount = 0;
  let profileCount = 0;

  try {
    const viewLog = fs.readFileSync(
      path.join(logsDir, "view-events.log"),
      "utf8"
    );
    viewCount = (viewLog.match(/\[/g) || []).length;

    const actionLog = fs.readFileSync(
      path.join(logsDir, "action-events.log"),
      "utf8"
    );
    actionCount = (actionLog.match(/\[/g) || []).length;

    const conversionLog = fs.readFileSync(
      path.join(logsDir, "conversion-events.log"),
      "utf8"
    );
    conversionCount = (conversionLog.match(/\[/g) || []).length;

    const feedbackLog = fs.readFileSync(
      path.join(logsDir, "feedback-events.log"),
      "utf8"
    );
    feedbackCount = (feedbackLog.match(/\[/g) || []).length;

    const profileLog = fs.readFileSync(
      path.join(logsDir, "profile-updates.log"),
      "utf8"
    );
    profileCount = (profileLog.match(/\[/g) || []).length;
  } catch (e) {
    // Ignore errors if files don't exist yet
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CDP Tracking Test Server</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .card { border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 20px; }
        .event-count { font-size: 24px; font-weight: bold; color: #007bff; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 8px 16px; 
               text-decoration: none; border-radius: 4px; margin-right: 10px; }
        .btn:hover { background: #0069d9; }
        .footer { margin-top: 40px; color: #777; font-size: 14px; }
        .stats { display: flex; justify-content: space-between; flex-wrap: wrap; }
        .stat-card { flex: 1; min-width: 120px; margin: 5px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }
      </style>
    </head>
    <body>
      <h1>CDP Tracking Test Server</h1>
      
      <div class="card">
        <h2>Server Status</h2>
        <p>The server is running and ready to receive tracking events.</p>
        <p>Endpoint: <code>http://localhost:${PORT}</code></p>
        <a href="/test" class="btn">Open Test Page</a>
      </div>
      
      <div class="card">
        <h2>Event Statistics</h2>
        <div class="stats">
          <div class="stat-card">
            <h3>View Events</h3>
            <div class="event-count">${viewCount}</div>
          </div>
          <div class="stat-card">
            <h3>Action Events</h3>
            <div class="event-count">${actionCount}</div>
          </div>
          <div class="stat-card">
            <h3>Conversion Events</h3>
            <div class="event-count">${conversionCount}</div>
          </div>
          <div class="stat-card">
            <h3>Feedback Events</h3>
            <div class="event-count">${feedbackCount}</div>
          </div>
          <div class="stat-card">
            <h3>Profile Updates</h3>
            <div class="event-count">${profileCount}</div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2>Test Your Tracking</h2>
        <p>To test your tracking implementation, make sure to set:</p>
        <pre>window.cdpTrackerApiDomain = "localhost:${PORT}";</pre>
        <p>in your client integration code.</p>
      </div>
      
      <div class="footer">
        <p>CDP Tracking Test Server | Running on Node.js</p>
      </div>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`CDP Tracking Test Server running on port ${PORT}`);
  console.log(`View the dashboard at http://localhost:${PORT}`);
  console.log(`Test page available at http://localhost:${PORT}/test`);
  console.log(`Logs are being saved to ${logsDir}`);
});
