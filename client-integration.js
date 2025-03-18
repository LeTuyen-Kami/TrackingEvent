/**
 * CDP Event Tracking Integration Code
 *
 * This script should be embedded on client websites to enable event tracking.
 * It loads the tracking script from CDN and sets up the global tracking function.
 */
(function () {
  // Configuration
  window.cdpTrackerId = "YOUR_TRACKER_ID"; // Unique identifier for the client
  window.cdpTrackerCdnDomain = "cdn.cdpdomain.com"; // CDN domain hosting the tracker script
  window.cdpTrackerApiDomain = "api.cdpdomain.com"; // API domain for sending tracking data

  // Metadata about the current page
  window.cdpPageTitle = encodeURIComponent(document.title);
  window.cdpPageUrl = encodeURIComponent(location.href);

  // Load the main tracking script from CDN
  var trackerJsPath = "/cdp-tracker.js";
  var src = "https://" + window.cdpTrackerCdnDomain + trackerJsPath;
  var jsNode = document.createElement("script");
  jsNode.async = true;
  jsNode.defer = true;
  jsNode.src = src;
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(jsNode, s);

  // Define internal tracking function that will be available before the script loads
  // This will queue events until the main script is loaded
  window._trackEvent =
    window._trackEvent ||
    function (eventType, eventName, eventData, extraParams) {
      window._trackEvent.queue = window._trackEvent.queue || [];
      window._trackEvent.queue.push({
        eventType: eventType,
        eventName: eventName,
        eventData: eventData || {},
        extraParams: extraParams || {},
        timestamp: new Date().getTime(),
      });
    };

  // Define the CDP global object with specific tracking methods
  window.CDP = window.CDP || {
    // Track view events (pageviews, content impressions)
    trackView: function (eventName, eventData) {
      window._trackEvent("view", eventName, eventData);
    },

    // Track action events (clicks, form submissions, user interactions)
    trackAction: function (eventName, eventData) {
      window._trackEvent("action", eventName, eventData);
    },

    // Track conversion events (purchases, sign-ups, goal completions)
    trackConversion: function (eventName, eventData, purchaseInfo) {
      window._trackEvent("conversion", eventName, eventData, {
        purchaseInfo: purchaseInfo || {
          transactionId: "",
          value: 0,
          currency: "USD",
          status: "Pending",
          items: [],
        },
      });
    },

    // Track feedback events (ratings, reviews, surveys)
    trackFeedback: function (eventName, eventData) {
      window._trackEvent("feedback", eventName, eventData);
    },

    // Update user profile information
    updateProfile: function (profileData, extData) {
      window._trackEvent(
        "profile",
        "update_profile",
        {},
        {
          profileData: profileData || {},
          extData: extData || {},
        }
      );
    },
  };

  // Helper function to parse UTM parameters
  window.parseUtmParams = function () {
    if (location.search.indexOf("utm_") > 0) {
      var search = location.search.substring(1);
      var json = decodeURI(search)
        .replace(/"/g, '\\"')
        .replace(/&/g, '","')
        .replace(/=/g, '":"');
      return JSON.parse('{"' + json + '"}');
    }
    return {};
  };
})();

// Track page view automatically when script loads
window.addEventListener("load", function () {
  window.CDP.trackView("page_view", window.parseUtmParams());
});
