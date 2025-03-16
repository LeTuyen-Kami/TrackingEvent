/**
 * This script runs inside an isolated iframe and is responsible for:
 * 1. Generating user fingerprints using thumbmarkjs
 * 2. Receiving tracking events from the parent page
 * 3. Sending tracking data to the CDP API
 * 4. Maintaining security by validating message origins
 */

// Configuration variables
var CONFIG = {
  trackerId: "",
  parentOrigin: "",
  apiDomain: "",
  sessionCacheMinutes: 30,
};

// Parse configuration from URL hash
function parseConfig() {
  if (location.hash && location.hash.length > 1) {
    try {
      // Lấy toàn bộ hash và giải mã
      var hashContent = decodeURIComponent(location.hash.substring(1));

      // Thử phân tích cấu hình dưới dạng JSON
      try {
        // Nếu là JSON hợp lệ (định dạng mới)
        var config = JSON.parse(hashContent);
        console.log("Parsed config from JSON:", config);

        if (config) {
          // Cập nhật cấu hình từ object JSON
          CONFIG.trackerId = config.trackerId || "";
          CONFIG.apiDomain = config.apiDomain || "";

          // Xử lý parentOrigin
          if (config.parentOrigin === "*") {
            CONFIG.parentOrigin = "*";
            console.warn(
              "CDP Tracker: Using wildcard origin is not recommended for production"
            );
          } else if (config.parentOrigin) {
            try {
              var url = new URL(config.parentOrigin);
              CONFIG.parentOrigin = url.origin;
              console.log(
                "CDP Tracker: Parent origin set to",
                CONFIG.parentOrigin
              );
            } catch (e) {
              console.error(
                "CDP Tracker: Invalid parent URL in config:",
                config.parentOrigin
              );
              // Fallback to wildcard in development
              CONFIG.parentOrigin = "*";
            }
          }

          return; // Đã xử lý xong cấu hình JSON
        }
      } catch (jsonError) {
        // Không phải JSON, thử xử lý theo định dạng cũ (trackerId_parentUrl)
        console.log("Not JSON format, trying legacy format:", hashContent);

        // Tìm vị trí của dấu "_" đầu tiên để tách trackerId và parentUrl
        var separatorIndex = hashContent.indexOf("_");

        if (separatorIndex > 0) {
          // Lấy trackerId (phần trước dấu "_" đầu tiên)
          CONFIG.trackerId = hashContent.substring(0, separatorIndex);

          // Lấy parentUrl (phần sau dấu "_" đầu tiên)
          var parentUrl = hashContent.substring(separatorIndex + 1);

          console.log("Parsed from hash - trackerId:", CONFIG.trackerId);
          console.log("Parsed from hash - parentUrl:", parentUrl);

          // Xử lý parentUrl để lấy origin hợp lệ
          if (parentUrl === "*") {
            CONFIG.parentOrigin = "*";
            console.warn(
              "CDP Tracker: Using wildcard origin is not recommended for production"
            );
          } else if (parentUrl) {
            // Try to construct a valid origin from the URL
            try {
              // Check if it's already a valid URL
              if (parentUrl.indexOf("://") > 0) {
                var url = new URL(parentUrl);
                CONFIG.parentOrigin = url.origin;
              } else {
                // If it's just a domain, construct an origin with the current protocol
                CONFIG.parentOrigin = location.protocol + "//" + parentUrl;
              }
              console.log(
                "CDP Tracker: Parent origin set to",
                CONFIG.parentOrigin
              );
            } catch (e) {
              console.error("CDP Tracker: Invalid parent URL:", parentUrl, e);
              // Try to use document.referrer as fallback
              if (document.referrer) {
                var referrerUrl = new URL(document.referrer);
                CONFIG.parentOrigin = referrerUrl.origin;
                console.log(
                  "CDP Tracker: Using referrer as parent origin:",
                  CONFIG.parentOrigin
                );
              } else {
                // Fallback to wildcard in development
                CONFIG.parentOrigin = "*";
                console.log(
                  "CDP Tracker: Using wildcard origin as last resort"
                );
              }
            }
          }
        } else {
          console.error("CDP Tracker: Invalid hash format, missing separator");
          // Fallback to using referrer
          if (document.referrer) {
            var referrerUrl = new URL(document.referrer);
            CONFIG.parentOrigin = referrerUrl.origin;
            CONFIG.trackerId = hashContent; // Assume the whole hash is trackerId
            console.log(
              "CDP Tracker: Using referrer as parent origin:",
              CONFIG.parentOrigin
            );
          } else {
            // Last resort
            CONFIG.parentOrigin = "*";
            CONFIG.trackerId = hashContent;
            console.log("CDP Tracker: Using wildcard origin as last resort");
          }
        }
      }
    } catch (e) {
      console.error("CDP Tracker: Error parsing configuration:", e);
      // Try to use document.referrer as fallback
      if (document.referrer) {
        var referrerUrl = new URL(document.referrer);
        CONFIG.parentOrigin = referrerUrl.origin;
        console.log(
          "CDP Tracker: Using referrer as parent origin:",
          CONFIG.parentOrigin
        );
      } else {
        // Last resort for development
        CONFIG.parentOrigin = "*";
        console.log("CDP Tracker: Using wildcard origin as last resort");
      }
    }
  } else {
    console.warn("CDP Tracker: No configuration hash found");
    // Try to use document.referrer as fallback
    if (document.referrer) {
      var referrerUrl = new URL(document.referrer);
      CONFIG.parentOrigin = referrerUrl.origin;
      console.log(
        "CDP Tracker: Using referrer as parent origin:",
        CONFIG.parentOrigin
      );
    } else {
      // Last resort for development
      CONFIG.parentOrigin = "*";
      console.log("CDP Tracker: Using wildcard origin as last resort");
    }
  }
}

// User session data
var SESSION = {
  fingerprint: "",
  visitorId: "",
  sessionId: "",
  lastActivity: 0,
};

// Load the thumbmarkjs library from CDN
function loadThumbmarkJs(callback) {
  console.log("Loading ThumbmarkJS...");
  var script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/@thumbmarkjs/thumbmarkjs/dist/thumbmark.umd.js";
  script.onload = function () {
    console.log("ThumbmarkJS loaded successfully");
    if (typeof ThumbmarkJS === "undefined") {
      console.error("ThumbmarkJS is undefined after loading");
      generateBasicFingerprint(callback);
    } else {
      callback();
    }
  };
  script.onerror = function (error) {
    console.error("Failed to load thumbmarkjs:", error);
    // Fallback to a basic fingerprint if thumbmarkjs fails to load
    generateBasicFingerprint(callback);
  };
  document.head.appendChild(script);
}

// Generate a basic fingerprint as fallback
function generateBasicFingerprint(callback) {
  console.log("Generating basic fingerprint...");
  var fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    timezone: new Date().getTimezoneOffset(),
    platform: navigator.platform,
    deviceMemory: navigator.deviceMemory || "unknown",
    hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
    plugins: Array.from(navigator.plugins || [])
      .map((p) => p.name)
      .join(","),
    timestamp: new Date().getTime(),
  };

  // Generate a hash from the fingerprint object
  var fingerprintStr = JSON.stringify(fingerprint);
  var hash = 0;
  for (var i = 0; i < fingerprintStr.length; i++) {
    hash = (hash << 5) - hash + fingerprintStr.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  var fingerprintValue = "basic_" + Math.abs(hash).toString(16);
  console.log("Generated basic fingerprint:", fingerprintValue);
  SESSION.fingerprint = fingerprintValue;
  if (callback) callback();
}

// Generate fingerprint using thumbmarkjs
function generateFingerprint(callback) {
  console.log("Generating fingerprint with ThumbmarkJS...");
  if (window.ThumbmarkJS) {
    try {
      ThumbmarkJS.getFingerprint()
        .then(function (result) {
          console.log("ThumbmarkJS fingerprint generated:", result);
          if (!result) {
            console.error("ThumbmarkJS returned empty fingerprint");
            generateBasicFingerprint(callback);
            return;
          }
          SESSION.fingerprint = result;
          if (callback) callback();
        })
        .catch(function (error) {
          console.error("ThumbmarkJS error:", error);
          generateBasicFingerprint(callback);
        });
    } catch (e) {
      console.error("Error calling ThumbmarkJS.getFingerprint():", e);
      generateBasicFingerprint(callback);
    }
  } else {
    console.error("ThumbmarkJS is not available");
    generateBasicFingerprint(callback);
  }
}

// Generate a unique visitor ID
function generateVisitorId() {
  // Use fingerprint as base for visitor ID
  var base = SESSION.fingerprint;

  // Add tracker ID to make it unique per client
  base += "_" + CONFIG.trackerId;

  // Add a random component for additional uniqueness
  var random = Math.random().toString(36).substring(2, 15);

  // Generate a hash from the combined string
  var hash = 0;
  for (var i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }

  SESSION.visitorId = "v_" + Math.abs(hash).toString(16) + "_" + random;

  // Store in localStorage for persistence if available
  try {
    localStorage.setItem("cdp_visitor_id", SESSION.visitorId);
  } catch (e) {
    // localStorage might not be available in some contexts
  }
}

// Generate a session ID
function generateSessionId() {
  var timestamp = new Date().getTime();
  var random = Math.random().toString(36).substring(2, 15);
  SESSION.sessionId = "s_" + timestamp + "_" + random;
  SESSION.lastActivity = timestamp;

  // Store in sessionStorage if available
  try {
    sessionStorage.setItem("cdp_session_id", SESSION.sessionId);
    sessionStorage.setItem("cdp_last_activity", timestamp.toString());
  } catch (e) {
    // sessionStorage might not be available in some contexts
  }
}

// Check if session is still valid or create a new one
function checkSession() {
  var now = new Date().getTime();
  var sessionTimeout = CONFIG.sessionCacheMinutes * 60 * 1000;

  // Try to get existing session from storage
  try {
    var storedSessionId = sessionStorage.getItem("cdp_session_id");
    var storedLastActivity = parseInt(
      sessionStorage.getItem("cdp_last_activity") || "0"
    );

    if (storedSessionId && now - storedLastActivity < sessionTimeout) {
      SESSION.sessionId = storedSessionId;
      SESSION.lastActivity = now;
      sessionStorage.setItem("cdp_last_activity", now.toString());
      return;
    }
  } catch (e) {
    // sessionStorage might not be available
  }

  // Create new session if none exists or expired
  generateSessionId();
}

// Initialize visitor data
function initVisitor(callback) {
  console.log("Initializing visitor data...");

  // Try to get existing visitor ID from storage
  try {
    var storedVisitorId = localStorage.getItem("cdp_visitor_id");
    if (storedVisitorId) {
      console.log("Found stored visitor ID:", storedVisitorId);
      SESSION.visitorId = storedVisitorId;
      checkSession();

      // Even if we have a stored visitor ID, we still need to generate a fingerprint
      generateFingerprint(function () {
        console.log(
          "Fingerprint generated for existing visitor:",
          SESSION.fingerprint
        );
        if (callback) callback();
      });
      return;
    }
  } catch (e) {
    console.error("Error accessing localStorage:", e);
    // localStorage might not be available
  }

  // Generate fingerprint and visitor ID
  console.log("No stored visitor ID found, generating new one...");
  generateFingerprint(function () {
    console.log("Fingerprint generated:", SESSION.fingerprint);

    // Ensure we have a fingerprint before generating visitor ID
    if (!SESSION.fingerprint) {
      console.warn(
        "Fingerprint is still empty after generation, using fallback"
      );
      var timestamp = new Date().getTime();
      var random = Math.random().toString(36).substring(2, 15);
      SESSION.fingerprint = "emergency_" + timestamp + "_" + random;
    }

    generateVisitorId();
    console.log("Visitor ID generated:", SESSION.visitorId);

    generateSessionId();
    console.log("Session ID generated:", SESSION.sessionId);

    if (callback) callback();
  });
}

// Update last activity time
function updateLastActivity() {
  SESSION.lastActivity = new Date().getTime();
  try {
    sessionStorage.setItem(
      "cdp_last_activity",
      SESSION.lastActivity.toString()
    );
  } catch (e) {
    // sessionStorage might not be available
  }
}

// Prepare common tracking data
function prepareCommonTrackingData() {
  console.log("Preparing common tracking data...");
  console.log("Current session:", SESSION);

  // Ensure we have visitor and session IDs
  if (!SESSION.visitorId || !SESSION.sessionId) {
    console.error("CDP Tracker: Missing visitor or session ID");
    return null;
  }

  // Check if fingerprint is empty and generate a basic one if needed
  if (!SESSION.fingerprint) {
    console.warn(
      "CDP Tracker: Fingerprint is empty, generating basic fingerprint"
    );
    // Generate a simple fingerprint based on current time and random value
    var timestamp = new Date().getTime();
    var random = Math.random().toString(36).substring(2, 15);
    SESSION.fingerprint = "fallback_" + timestamp + "_" + random;
  }

  // Update last activity time
  updateLastActivity();

  // Return common tracking data
  return {
    trackerId: CONFIG.trackerId,
    visitorId: SESSION.visitorId,
    sessionId: SESSION.sessionId,
    fingerprint: SESSION.fingerprint,
    timestamp: SESSION.lastActivity,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenResolution: screen.width + "x" + screen.height,
    timezone: new Date().getTimezoneOffset(),
  };
}

// Send tracking data to CDP API
function sendTrackingData(endpoint, data) {
  // Determine protocol to use (use same protocol as current page)
  var protocol = location.protocol;

  // Log the request details
  console.log(
    "Sending tracking data to:",
    protocol + "//" + CONFIG.apiDomain + endpoint
  );
  console.log("Data:", data);

  // Send data to CDP API
  fetch(protocol + "//" + CONFIG.apiDomain + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    mode: "cors",
    credentials: "omit",
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("CDP API responded with status: " + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      console.log("Tracking data sent successfully:", data);
      // Optional: Send success confirmation to parent
      sendToParent({
        type: "TRACK_SUCCESS",
        eventType: data.eventType,
        eventName: data.eventName,
        timestamp: new Date().getTime(),
      });
    })
    .catch(function (error) {
      console.error("CDP Tracker: Error sending tracking data:", error);

      // Optional: Send error to parent
      sendToParent({
        type: "TRACK_ERROR",
        error: error.message,
        timestamp: new Date().getTime(),
      });
    });
}

// Process view events
function processViewEvent(eventName, eventData) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  var trackingData = Object.assign({}, commonData, {
    eventType: "view",
    eventName: eventName,
    eventData: eventData,
    referrer: eventData.referrer || "",
  });

  sendTrackingData("/track/view", trackingData);
}

// Process action events
function processActionEvent(eventName, eventData) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  var trackingData = Object.assign({}, commonData, {
    eventType: "action",
    eventName: eventName,
    eventData: eventData,
    referrer: eventData.referrer || "",
  });

  sendTrackingData("/track/action", trackingData);
}

// Process conversion events
function processConversionEvent(
  eventName,
  eventData,
  transactionId,
  items,
  value,
  currency
) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  var trackingData = Object.assign({}, commonData, {
    eventType: "conversion",
    eventName: eventName,
    eventData: eventData,
    transactionId: transactionId || "",
    items: items || [],
    value: value || 0,
    currency: currency || "USD",
    referrer: eventData.referrer || "",
  });

  sendTrackingData("/track/conversion", trackingData);
}

// Process feedback events
function processFeedbackEvent(eventName, eventData) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  var trackingData = Object.assign({}, commonData, {
    eventType: "feedback",
    eventName: eventName,
    eventData: eventData,
    referrer: eventData.referrer || "",
  });

  sendTrackingData("/track/feedback", trackingData);
}

// Process profile updates
function processProfileUpdate(profileData, extData) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  var trackingData = Object.assign({}, commonData, {
    eventType: "profile",
    profileData: profileData || {},
    extData: extData || {},
  });

  sendTrackingData("/profile/update", trackingData);
}

// Send message to parent window
function sendToParent(message) {
  if (
    CONFIG.parentOrigin &&
    CONFIG.parentOrigin !== "TRACKER" &&
    CONFIG.parentOrigin !== ""
  ) {
    try {
      window.parent.postMessage(message, CONFIG.parentOrigin);
    } catch (e) {
      console.error("CDP Tracker: Error sending message to parent:", e);
      // Fallback to wildcard origin in development environment
      try {
        window.parent.postMessage(message, "*");
      } catch (e2) {
        console.error(
          "CDP Tracker: Error sending message with wildcard origin:",
          e2
        );
      }
    }
  } else {
    console.warn("CDP Tracker: Invalid parent origin:", CONFIG.parentOrigin);
    // Use wildcard origin in development environment
    try {
      window.parent.postMessage(message, "*");
      console.log("CDP Tracker: Using wildcard origin as fallback");
    } catch (e) {
      console.error(
        "CDP Tracker: Error sending message with wildcard origin:",
        e
      );
    }
  }
}

// Handle messages from parent window
function handleMessage(event) {
  // Validate origin if not using wildcard
  if (CONFIG.parentOrigin !== "*" && event.origin !== CONFIG.parentOrigin) {
    console.error(
      "CDP Tracker: Message from unauthorized origin:",
      event.origin
    );
    return;
  }

  // Process message
  try {
    var message = event.data;

    if (message && message.type === "TRACK_EVENT") {
      var eventType = message.eventType;
      var eventName = message.eventName;
      var eventData = message.eventData || {};

      switch (eventType) {
        case "view":
          processViewEvent(eventName, eventData);
          break;
        case "action":
          processActionEvent(eventName, eventData);
          break;
        case "conversion":
          processConversionEvent(
            eventName,
            eventData,
            message.transactionId,
            message.items,
            message.value,
            message.currency
          );
          break;
        case "feedback":
          processFeedbackEvent(eventName, eventData);
          break;
        case "profile":
          processProfileUpdate(message.profileData, message.extData);
          break;
        default:
          console.warn("CDP Tracker: Unknown event type:", eventType);
          break;
      }
    }
  } catch (e) {
    console.error("CDP Tracker: Error processing message:", e);
  }
}

// Initialize the tracker
function init() {
  // Parse configuration from URL hash
  parseConfig();

  // Set up message listener
  window.addEventListener("message", handleMessage, false);

  // Load thumbmarkjs and initialize visitor
  loadThumbmarkJs(function () {
    initVisitor(function () {
      // Notify parent that tracker is ready
      sendToParent("CDP_TRACKER_READY");
    });
  });
}

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
