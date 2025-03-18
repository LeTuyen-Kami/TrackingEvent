# CDP Event Tracking System

This is a complete Customer Data Platform (CDP) event tracking system that allows website owners to track user events on their websites. The system uses an iframe-based approach for security and privacy, and generates user fingerprints for visitor identification.

## Components

The system consists of three main components:

1. **Client Integration Code** (`client-integration.js`): A script that website owners embed on their websites.
2. **CDN Tracker Script** (`cdp-tracker.js`): A script hosted on a CDN that creates an iframe and handles communication.
3. **Tracker Iframe** (`tracker-iframe.html`): An HTML file loaded in an iframe that handles fingerprinting and API communication.

## How to Use

### 1. Set Up Your CDN

Host the following files on your CDN:

- `cdp-tracker.js`
- `tracker-iframe.html`

The system uses ThumbmarkJS from its official CDN, so you don't need to host that library yourself.

### 2. Set Up Your API Endpoint

Create API endpoints at:

- `https://api.cdpdomain.com/track/view` - For view events
- `https://api.cdpdomain.com/track/action` - For action events
- `https://api.cdpdomain.com/track/conversion` - For conversion events
- `https://api.cdpdomain.com/track/feedback` - For feedback events
- `https://api.cdpdomain.com/profile/update` - For profile updates

### 3. Integrate the Client Code

Website owners should add the following script to their website:

```html
<script src="https://cdn.cdpdomain.com/client-integration.js"></script>
```

### 4. Track Events

Once integrated, website owners can track different types of events using the global `CDP` object:

#### View Events

For tracking page views, content impressions, etc.

```javascript
// Track a page view
CDP.trackView("page_view", {
  page: window.location.pathname,
});

// Track content impression
CDP.trackView("content_impression", {
  content_id: "article-123",
  content_type: "article",
});
```

#### Action Events

For tracking user interactions like clicks, form submissions, etc.

```javascript
// Track a button click
CDP.trackAction("button_click", {
  button_id: "signup-button",
  button_text: "Sign Up",
});

// Track a form submission
CDP.trackAction("form_submit", {
  form_id: "contact-form",
  form_name: "Contact Form",
});
```

#### Conversion Events

For tracking business outcomes like purchases, sign-ups, etc.

```javascript
// Track a purchase
CDP.trackConversion(
  "purchase",
  {
    // Event data
    payment_method: "credit_card",
  },
  {
    transactionId: "TXN-20250303-0001",
    value: 1029.98,
    currency: "USD",
    status: "Completed",
    timestamp: "2025-03-03T04:36:02.955Z",
    store: {
      id: "STORE-001",
      name: "Example Store",
      branch: "Downtown",
      location: {
        country: "USA",
        state: "California",
        city: "San Francisco",
        address: "123 Market Street",
      },
    },
    customer: {
      id: "CUST-123456",
      email: "john.doe@example.com",
      phone: "+84901234567",
      firstName: "John",
      lastName: "Doe",
      type: "VIP",
      segment: "High-Value",
      membershipId: "MEM-98765",
      isNewCustomer: false,
    },
    payment: {
      method: "Credit Card",
      gateway: "Stripe",
      installments: 3,
      status: "Paid",
      cardType: "Visa",
      last4: "4242",
    },
    discount: {
      total: 50.75,
      code: "SPRINGSALE2025",
      type: "Percentage",
      campaign: "Spring Sale",
    },
    items: [
      {
        id: "PROD-001",
        sku: "SKU-12345",
        name: "Smartphone",
        category: "Electronics",
        subcategory: "Phones",
        brand: "Apple",
        variant: "Black",
        price: 999.99,
        originalPrice: 1050.0,
        quantity: 1,
        currency: "USD",
        discount: {
          amount: 25.0,
          type: "Fixed",
        },
      },
      {
        id: "PROD-002",
        sku: "SKU-54321",
        name: "Phone Case",
        category: "Accessories",
        subcategory: "Phone Cases",
        brand: "OtterBox",
        variant: "Clear",
        price: 29.99,
        originalPrice: 39.99,
        quantity: 1,
        currency: "USD",
        discount: {
          amount: 10.0,
          type: "Fixed",
        },
      },
    ],
  }
);

// Track a sign-up
CDP.trackConversion(
  "signup",
  {
    signup_method: "email",
  },
  {
    transactionId: "USER123",
    value: 0,
    currency: "USD",
    status: "Completed",
    items: [],
  }
);
```

#### Feedback Events

For tracking user feedback, ratings, reviews, etc.

```javascript
// Track a product rating
CDP.trackFeedback("product_rating", {
  product_id: "PROD1",
  rating: 5,
  comment: "Great product!",
});

// Track a survey response
CDP.trackFeedback("survey_response", {
  survey_id: "SURV1",
  question_id: "Q1",
  response: "Very satisfied",
});
```

#### Profile Updates

For updating user profile information.

```javascript
// Update user profile
CDP.updateProfile(
  {
    // Profile data
    email: "user@example.com",
    name: "John Doe",
    age: 30,
    interests: ["technology", "sports"],
  },
  {
    // Extended data
    source: "registration_form",
    consent: {
      marketing: true,
      analytics: true,
    },
  }
);
```

## Security Features

- Communication between the parent page and iframe uses `postMessage` with origin validation.
- The iframe is hidden and isolated from the parent page.
- Fingerprinting is done in the isolated iframe context.
- CORS is properly configured for API requests.

## Customization

Website owners can customize the tracking by modifying the configuration variables in the client integration code:

```javascript
window.cdpTrackerId = "YOUR_TRACKER_ID"; // Unique identifier for the client
window.cdpTrackerCdnDomain = "cdn.cdpdomain.com"; // CDN domain hosting the tracker script
window.cdpTrackerApiDomain = "api.cdpdomain.com"; // API domain for sending tracking data
```

## Data Collected

The system collects the following data:

- Event name and custom event data
- Page URL and title
- Referrer URL
- Timestamp
- User agent and language
- Screen resolution
- Timezone
- Fingerprint generated by ThumbmarkJS
- Visitor ID and session ID

## About ThumbmarkJS

This system uses [ThumbmarkJS](https://www.npmjs.com/package/@thumbmarkjs/thumbmarkjs), an open-source browser fingerprinting library that collects various browser and device information, including:

- Audio fingerprint
- Canvas fingerprint
- WebGL fingerprint
- Available fonts and how they render
- Video card information
- Browser languages and time zone
- Browser permissions
- Available plugins
- Screen details including media queries
- And many other browser-specific attributes

ThumbmarkJS is loaded from its official CDN at `https://cdn.jsdelivr.net/npm/@thumbmarkjs/thumbmarkjs/dist/thumbmark.umd.js`.

## Privacy Considerations

When implementing this tracking system, make sure to:

1. Include information about the tracking in your privacy policy
2. Get appropriate consent from users where required by law (GDPR, CCPA, etc.)
3. Provide opt-out mechanisms where required
4. Implement data retention policies for collected information

## Technical Requirements

- Modern browsers with support for:
  - postMessage API
  - Fetch API
  - localStorage/sessionStorage (for better user tracking)
  - Canvas and WebGL (for fingerprinting)

## Troubleshooting

If tracking is not working:

1. Check browser console for errors
2. Verify that all files are properly hosted on the CDN
3. Ensure the API endpoints are accessible and responding correctly
4. Check that the origin validation is not blocking legitimate messages

# TackingEvent
