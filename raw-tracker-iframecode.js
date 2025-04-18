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
  ipAddress: "",
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

  // Detect browser information
  var browserInfo = detectBrowser();

  // Detect device information
  var deviceInfo = detectDevice();

  // Get page performance data
  var performanceData = getPerformanceData();

  // Get network information
  var networkInfo = getNetworkInfo();

  // Get current page URL and referrer
  var urlInfo = getUrlInfo();

  // Generate ISO timestamp
  var isoTimestamp = new Date(SESSION.lastActivity).toISOString();

  // Return common tracking data with enhanced information
  return {
    // Basic tracking info
    trackerId: CONFIG.trackerId,
    visitorId: SESSION.visitorId,
    sessionId: SESSION.sessionId,
    fingerprint: SESSION.fingerprint,
    timestamp: SESSION.lastActivity,

    // ISO formatted timestamp
    timestampISO: isoTimestamp,

    // User agent info
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages ? JSON.stringify(navigator.languages) : "",
    doNotTrack:
      navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack,

    // Browser info with simplified name
    browserName: browserInfo.browser,
    browserVersion: browserInfo.version,

    // IP address
    ipAddress: CONFIG.ipAddress,

    // Device identification
    deviceOs: deviceInfo.os + " " + deviceInfo.osVersion,
    deviceType: getDeviceTypeDescription(deviceInfo),

    // Screen and window info
    screenResolution: screen.width + "x" + screen.height,
    screenColorDepth: screen.colorDepth,
    screenOrientation: screen.orientation ? screen.orientation.type : "",
    windowSize: window.innerWidth + "x" + window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,

    // Browser capabilities
    cookiesEnabled: navigator.cookieEnabled,
    localStorageAvailable: isLocalStorageAvailable(),
    sessionStorageAvailable: isSessionStorageAvailable(),

    // System info
    platform: navigator.platform,
    timezone: new Date().getTimezoneOffset(),
    timezoneString: Intl.DateTimeFormat().resolvedOptions().timeZone || "",

    // Device capabilities
    deviceMemory: navigator.deviceMemory || "unknown",
    hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
    maxTouchPoints: navigator.maxTouchPoints || 0,

    // Enhanced data
    browser: browserInfo.browser,
    browserVersion: browserInfo.version,
    os: deviceInfo.os,
    osVersion: deviceInfo.osVersion,
    deviceType: deviceInfo.deviceType,
    isMobile: deviceInfo.isMobile,
    isTablet: deviceInfo.isTablet,
    isDesktop: deviceInfo.isDesktop,

    // Page URL information
    pageUrl: urlInfo.currentUrl,
    prePageUrl: urlInfo.referrerUrl,

    // Performance data
    pageLoadTime: performanceData.pageLoadTime,
    domInteractive: performanceData.domInteractive,
    domComplete: performanceData.domComplete,

    // Network info
    connectionType: networkInfo.type,
    effectiveConnectionType: networkInfo.effectiveType,
    downlink: networkInfo.downlink,
    rtt: networkInfo.rtt,

    // Referrer and URL data
    referrer: document.referrer,
    referrerDomain: getReferrerDomain(),

    // Session data
    sessionDuration:
      SESSION.lastActivity -
      parseInt(
        sessionStorage.getItem("cdp_session_start") || SESSION.lastActivity
      ),
    isNewVisitor:
      !localStorage.getItem("cdp_visitor_id") ||
      localStorage.getItem("cdp_visitor_id") !== SESSION.visitorId,
    isNewSession:
      !sessionStorage.getItem("cdp_session_id") ||
      sessionStorage.getItem("cdp_session_id") !== SESSION.sessionId,

    // Private data fields - these should be handled with care and only collected when explicitly provided
    // These fields are marked as private and should be encrypted or hashed before storage
    privateEmail: "", // Should be populated only when user explicitly provides email
    privatePhone: "", // Should be populated only when user explicitly provides phone
  };
}

// Helper function to detect browser
function detectBrowser() {
  var userAgent = navigator.userAgent;
  var browser = "unknown";
  var version = "unknown";

  // Detect Chrome
  if (
    /Chrome/.test(userAgent) &&
    !/Chromium|Edge|Edg|OPR|Opera/.test(userAgent)
  ) {
    browser = "Chrome";
    version = userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || "unknown";
  }
  // Detect Firefox
  else if (/Firefox/.test(userAgent)) {
    browser = "Firefox";
    version = userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || "unknown";
  }
  // Detect Safari
  else if (
    /Safari/.test(userAgent) &&
    !/Chrome|Chromium|Edge|Edg|OPR|Opera/.test(userAgent)
  ) {
    browser = "Safari";
    version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || "unknown";
  }
  // Detect Edge
  else if (/Edge|Edg/.test(userAgent)) {
    browser = "Edge";
    var edgeMatch = userAgent.match(/Edge\/(\d+\.\d+)|Edg\/(\d+\.\d+)/);
    version = edgeMatch?.[1] || edgeMatch?.[2] || "unknown";
  }
  // Detect Opera
  else if (/OPR|Opera/.test(userAgent)) {
    browser = "Opera";
    var operaMatch = userAgent.match(/OPR\/(\d+\.\d+)|Opera\/(\d+\.\d+)/);
    version = operaMatch?.[1] || operaMatch?.[2] || "unknown";
  }
  // Detect IE
  else if (/MSIE|Trident/.test(userAgent)) {
    browser = "Internet Explorer";
    var ieMatch =
      userAgent.match(/MSIE (\d+\.\d+)/) || userAgent.match(/rv:(\d+\.\d+)/);
    version = ieMatch?.[1] || "unknown";
  }

  return { browser: browser, version: version };
}

//Helper get IP address
function getIpAddress() {
  return fetch("https://api.ipify.org?format=json")
    .then((response) => response.json())
    .then((data) => data.ip)
    .catch((error) => {
      console.error("Error getting IP address:", error);
      return "unknown";
    });
}

// Helper function to detect device
function detectDevice() {
  var userAgent = navigator.userAgent;
  var platform = navigator.platform;
  var os = "unknown";
  var osVersion = "unknown";
  var deviceType = "unknown";
  var isMobile = false;
  var isTablet = false;
  var isDesktop = false;

  // Detect iOS
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    os = "iOS";
    var iosMatch = userAgent.match(/OS (\d+_\d+)/);
    osVersion = iosMatch ? iosMatch[1].replace("_", ".") : "unknown";
    deviceType = /iPad/.test(userAgent) ? "tablet" : "mobile";
    isMobile = deviceType === "mobile";
    isTablet = deviceType === "tablet";
  }
  // Detect Android
  else if (/Android/.test(userAgent)) {
    os = "Android";
    var androidMatch = userAgent.match(/Android (\d+\.\d+)/);
    osVersion = androidMatch ? androidMatch[1] : "unknown";
    deviceType = /Mobile/.test(userAgent) ? "mobile" : "tablet";
    isMobile = deviceType === "mobile";
    isTablet = deviceType === "tablet";
  }
  // Detect Windows
  else if (/Win/.test(platform)) {
    os = "Windows";
    var winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    osVersion = winMatch ? winMatch[1] : "unknown";
    deviceType = "desktop";
    isDesktop = true;
  }
  // Detect macOS
  else if (/Mac/.test(platform)) {
    os = "macOS";
    var macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    osVersion = macMatch ? macMatch[1].replace("_", ".") : "unknown";
    deviceType = "desktop";
    isDesktop = true;
  }
  // Detect Linux
  else if (/Linux/.test(platform)) {
    os = "Linux";
    deviceType = "desktop";
    isDesktop = true;
  }

  return {
    os: os,
    osVersion: osVersion,
    deviceType: deviceType,
    isMobile: isMobile,
    isTablet: isTablet,
    isDesktop: isDesktop,
  };
}

// Helper function to get performance data
function getPerformanceData() {
  var pageLoadTime = 0;
  var domInteractive = 0;
  var domComplete = 0;

  if (window.performance && window.performance.timing) {
    var timing = window.performance.timing;
    pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    domInteractive = timing.domInteractive - timing.navigationStart;
    domComplete = timing.domComplete - timing.navigationStart;
  }

  return {
    pageLoadTime: pageLoadTime,
    domInteractive: domInteractive,
    domComplete: domComplete,
  };
}

// Helper function to get network information
function getNetworkInfo() {
  var connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  var type = "unknown";
  var effectiveType = "unknown";
  var downlink = 0;
  var rtt = 0;

  if (connection) {
    type = connection.type || "unknown";
    effectiveType = connection.effectiveType || "unknown";
    downlink = connection.downlink || 0;
    rtt = connection.rtt || 0;
  }

  return {
    type: type,
    effectiveType: effectiveType,
    downlink: downlink,
    rtt: rtt,
  };
}

// Helper function to get referrer domain
function getReferrerDomain() {
  if (!document.referrer) return "";
  try {
    var url = new URL(document.referrer);
    return url.hostname;
  } catch (e) {
    return "";
  }
}

// Helper function to check if localStorage is available
function isLocalStorageAvailable() {
  try {
    var test = "__test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to check if sessionStorage is available
function isSessionStorageAvailable() {
  try {
    var test = "__test__";
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to generate a device ID
function generateDeviceId() {
  // Create a device ID based on fingerprint and device characteristics
  var deviceIdBase =
    SESSION.fingerprint +
    "_" +
    navigator.platform +
    "_" +
    screen.width +
    "x" +
    screen.height +
    "_" +
    navigator.hardwareConcurrency;

  // Hash the device ID base to create a consistent ID
  var hash = 0;
  for (var i = 0; i < deviceIdBase.length; i++) {
    hash = (hash << 5) - hash + deviceIdBase.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return "dev_" + Math.abs(hash).toString(16);
}

// Helper function to get a user-friendly device type description
function getDeviceTypeDescription(deviceInfo) {
  if (deviceInfo.isTablet) {
    return "Tablet";
  } else if (deviceInfo.isMobile) {
    return "Mobile";
  } else if (deviceInfo.isDesktop) {
    if (/macbook|macbookpro|macbookair/i.test(navigator.userAgent)) {
      return "MacBook";
    } else if (/surface/i.test(navigator.userAgent)) {
      return "Surface";
    } else {
      return "Laptop";
    }
  } else {
    return "Unknown";
  }
}

// Helper function to get current URL and referrer information
function getUrlInfo() {
  var currentUrl = "";
  var referrerUrl = "";

  try {
    // Try to get the parent page URL through postMessage communication
    if (window.parent && window.parent !== window) {
      // The iframe can't directly access parent URL due to same-origin policy
      // This information should be passed from the parent page
      currentUrl = document.referrer || "";
    } else {
      currentUrl = window.location.href;
    }

    // Get the referrer URL
    referrerUrl = document.referrer || "";
  } catch (e) {
    console.error("Error getting URL information:", e);
  }

  return {
    currentUrl: currentUrl,
    referrerUrl: referrerUrl,
  };
}

// Function to update private user data - should only be called when user explicitly provides this information
function updatePrivateUserData(email, phone) {
  var commonData = prepareCommonTrackingData();
  if (!commonData) return;

  // Update the private fields
  if (email) {
    commonData.privateEmail = email;
  }

  if (phone) {
    commonData.privatePhone = phone;
  }

  return commonData;
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

// Get IP address and set it to ipAddress variable
getIpAddress().then((ip) => {
  CONFIG.ipAddress = ip;
  console.log("IP address:", CONFIG.ipAddress);
});
