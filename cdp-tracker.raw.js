/**
 * CDP Tracker Script (CDN hosted)
 *
 * This script is loaded from the CDN and is responsible for:
 * 1. Creating an iframe to isolate tracking functionality
 * 2. Setting up communication between the parent page and the iframe
 * 3. Processing queued events and forwarding them to the iframe
 */
(function () {
  // Check if tracker is already initialized
  if (typeof window.CDPTracker !== "undefined") {
    return;
  }

  // Get configuration from the parent page
  var trackerId = window.cdpTrackerId || "12";
  var cdnDomain = window.cdpTrackerCdnDomain || "cdn.cdpdomain.com";
  var apiDomain = window.cdpTrackerApiDomain || "api.cdpdomain.com";
  var endpoint = window.cdpTrackerEndpoint || "/track/view";
  var header = window.cdpTrackerHeader;

  var currentPageUrl = location.protocol + "//" + location.host;
  var protocol = "https";
  // Create the tracker object
  var cdpTracker = {
    iframe: null,
    iframeLoaded: false,
    messageQueue: [],
  };

  // Initialize the tracker
  cdpTracker.init = function () {
    // Create the iframe if it doesn't exist
    if (!document.getElementById("cdp_tracker_iframe")) {
      // Ensure we have a valid origin for the current page
      var currentPageOrigin = location.protocol + "//" + location.host;

      // Create a config object to pass to the iframe
      var iframeConfig = {
        trackerId: trackerId,
        parentOrigin: currentPageOrigin,
        apiDomain: apiDomain,
        protocol: protocol,
        endpoint: endpoint,
        header: header,
      };

      // Encode the config as JSON and add to hash
      var configParam = encodeURIComponent(JSON.stringify(iframeConfig));

      // Create iframe URL with config in the hash
      var iframeSrc = "https://container-dev.dragoncdp.com/#" + configParam;

      console.log("Creating iframe with src:", iframeSrc);

      var iframe = document.createElement("iframe");
      iframe.setAttribute(
        "style",
        "display:none!important;width:0px!important;height:0px!important;border:0!important;"
      );
      iframe.width = 0;
      iframe.height = 0;
      iframe.id = "cdp_tracker_iframe";
      iframe.src = iframeSrc;

      // Append iframe to the body
      var body = document.getElementsByTagName("body")[0];
      if (body) {
        body.appendChild(iframe);
        this.iframe = iframe;

        // Set up message listener for iframe communication
        this.setupMessageListener();
      } else {
        // If body is not available yet, try again later
        setTimeout(function () {
          cdpTracker.init();
        }, 100);
      }
    }
  };

  // Set up message listener for iframe communication
  cdpTracker.setupMessageListener = function () {
    window.addEventListener(
      "message",
      function (event) {
        try {
          var message = event.data;

          console.log("message", message);

          if (message === "CDP_TRACKER_READY") {
            cdpTracker.iframeLoaded = true;
            cdpTracker.processQueue();

            // Process any events that were queued before the script loaded
            if (
              window._trackEvent &&
              window._trackEvent.queue &&
              window._trackEvent.queue.length > 0
            ) {
              var queue = window._trackEvent.queue;
              window._trackEvent.queue = [];

              for (var i = 0; i < queue.length; i++) {
                var item = queue[i];
                cdpTracker.processEvent(
                  item.eventType,
                  item.eventName,
                  item.eventData,
                  item.extraParams
                );
              }
            }
          }
        } catch (e) {
          console.error("Error processing message from CDP tracker iframe:", e);
        }
      },
      false
    );
  };

  // Send a message to the iframe
  cdpTracker.sendToIframe = function (message) {
    if (!this.iframe || !this.iframeLoaded) {
      this.messageQueue.push(message);
      return;
    }

    try {
      // Determine if we're in a development environment (localhost)
      var isDevelopment =
        location.hostname === "localhost" || location.hostname === "127.0.0.1";

      // Use wildcard origin in development, specific origin in production
      var targetOrigin = "*";

      console.log("Sending message to iframe with targetOrigin:", targetOrigin);
      this.iframe.contentWindow.postMessage(message, targetOrigin);
    } catch (e) {
      console.error("Error sending message to CDP tracker iframe:", e);
      // Try with wildcard as fallback
      try {
        this.iframe.contentWindow.postMessage(message, "*");
      } catch (e2) {
        console.error(
          "Error sending message to CDP tracker iframe with wildcard origin:",
          e2
        );
      }
    }
  };

  // Process queued messages
  cdpTracker.processQueue = function () {
    if (!this.iframeLoaded) {
      return;
    }

    while (this.messageQueue.length > 0) {
      var message = this.messageQueue.shift();
      this.sendToIframe(message);
    }
  };

  // Process different types of events
  cdpTracker.processEvent = function (
    eventType,
    eventName,
    eventData,
    extraParams
  ) {
    if (!eventType || !eventName) {
      return;
    }

    // Common event data
    var commonData = {
      type: "TRACK_EVENT",
      eventType: eventType,
      trackerId: trackerId,
      eventName: eventName,
      eventData: eventData || {},
      pageUrl: window.cdpPageUrl || encodeURIComponent(location.href),
      pageTitle: window.cdpPageTitle || encodeURIComponent(document.title),
      referrer: encodeURIComponent(document.referrer),
      timestamp: new Date().getTime(),
    };

    // Add extra parameters based on event type
    var event = Object.assign({}, commonData);

    if (eventType === "purchase" && extraParams) {
      // Use the new purchaseInfo object structure
      event.purchaseInfo = extraParams.purchaseInfo
        ? {
            ...(extraParams.purchaseInfo?.purchase || {}),
            ...(extraParams.purchaseInfo?.product || {}),
          }
        : {};

      console.log("purchaseInfo", event.purchaseInfo);
    } else if (eventType === "profile" && extraParams) {
      event.profileData = extraParams.profileData || {};
      event.extData = extraParams.extData || {};
    }

    console.log("processEvent", event);

    // Send to iframe
    this.sendToIframe(event);
  };

  // Track view events
  cdpTracker.trackView = function (eventName, eventData) {
    this.processEvent("view", eventName, eventData);
  };

  // Track action events
  cdpTracker.trackAction = function (eventName, eventData) {
    this.processEvent("action", eventName, eventData);
  };

  // Track purchase events
  cdpTracker.trackPurchase = function (eventName, eventData, purchaseInfo) {
    var extraParams = {
      purchaseInfo: purchaseInfo || {
        transactionId: "",
        value: 0,
        currency: "USD",
        status: "Pending",
        items: [],
      },
    };
    this.processEvent("purchase", eventName, eventData, extraParams);
  };

  // Track feedback events
  cdpTracker.trackFeedback = function (eventName, eventData) {
    this.processEvent("feedback", eventName, eventData);
  };

  // Update user profile
  cdpTracker.updateProfile = function (profileData, extData) {
    var extraParams = {
      profileData: profileData || {},
      extData: extData || {},
    };
    this.processEvent("profile", "update_profile", {}, extraParams);
  };

  // Initialize the tracker
  cdpTracker.init();

  // Override the internal tracking function
  window._trackEvent = function (eventType, eventName, eventData, extraParams) {
    cdpTracker.processEvent(eventType, eventName, eventData, extraParams);
  };

  // Set up the CDP global object
  window.CDP = {
    trackView: function (eventName, eventData) {
      cdpTracker.trackView(eventName, eventData);
    },
    trackAction: function (eventName, eventData) {
      cdpTracker.trackAction(eventName, eventData);
    },
    trackPurchase: function (eventName, eventData, purchaseInfo) {
      cdpTracker.trackPurchase(eventName, eventData, purchaseInfo);
    },
    trackFeedback: function (eventName, eventData) {
      cdpTracker.trackFeedback(eventName, eventData);
    },
    updateProfile: function (profileData, extData) {
      cdpTracker.updateProfile(profileData, extData);
    },
    track: function (eventName, eventData, purchaseInfo) {
      cdpTracker.trackPurchase(eventName, eventData, purchaseInfo);
    },
  };

  // Expose the tracker object
  window.CDPTracker = cdpTracker;
})();
