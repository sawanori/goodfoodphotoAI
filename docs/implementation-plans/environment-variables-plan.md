# Implementation Plan: Environment Variables and Settings Documentation

## Document Information

| Item | Details |
|------|---------|
| Plan ID | ENV-001 |
| Created Date | 2026-01-17 |
| Status | Draft |
| Complexity | Low |
| Estimated Duration | 30 minutes |
| Assigned Model | Sonnet (Task agent) |

---

## Objective

Add comprehensive environment variable documentation, CORS configuration, Apple Shared Secret details, and Free Tier implementation specifications to the technical design and workplan documents.

---

## Target Files

1. `/home/noritakasawada/project/20260117/docs/design/bananadish-design.md`
2. `/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md`

---

## Changes Required

### 1. Environment Variables Section (Design Document)

**Location**: After the "Backend Design (Cloud Run + Node.js)" section, before the "Database Design (Firestore)" section.

**Action**: Insert new section

**Content**:
```markdown
## Environment Variables Configuration

### Cloud Run (Backend)

The following environment variables must be configured in Cloud Run service:

| Variable Name | Required | Description | Example | Source |
|--------------|----------|-------------|---------|--------|
| GEMINI_API_KEY | Yes | Gemini API key for AI image generation | AIza... | Secret Manager |
| FIREBASE_PROJECT_ID | Yes | Firebase project identifier | bananadish-prod | Configuration |
| GOOGLE_CLOUD_PROJECT | Yes | GCP project identifier (usually same as Firebase) | bananadish-prod | Configuration |
| PORT | No | Server listening port | 8080 | Default |
| NODE_ENV | No | Node.js environment mode | production | Configuration |
| CORS_ORIGIN | Yes | Allowed origin for CORS | https://bananadish.app | Configuration |
| APPLE_SHARED_SECRET | Yes | Apple IAP receipt verification shared secret | xxxx... | Secret Manager |
| RATE_LIMIT_PER_MINUTE | No | Maximum requests per user per minute | 10 | Default |

**Secret Manager Configuration**:
```bash
# Store Gemini API key
gcloud secrets create GEMINI_API_KEY \
  --data-file=- <<EOF
AIzaSy...YOUR_API_KEY
EOF

# Store Apple Shared Secret
gcloud secrets create APPLE_SHARED_SECRET \
  --data-file=- <<EOF
your_apple_shared_secret_here
EOF

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding APPLE_SHARED_SECRET \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### React Native (Frontend)

The following environment variables must be configured in the React Native app:

| Variable Name | Required | Description | Example |
|--------------|----------|-------------|---------|
| EXPO_PUBLIC_API_URL | Yes | Backend API base URL | https://bananadish-api-xxx.run.app |
| EXPO_PUBLIC_FIREBASE_API_KEY | Yes | Firebase Web API Key | AIzaSyC... |
| EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN | Yes | Firebase Auth domain | bananadish-prod.firebaseapp.com |
| EXPO_PUBLIC_FIREBASE_PROJECT_ID | Yes | Firebase project identifier | bananadish-prod |
| EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET | Yes | Firebase Storage bucket | bananadish-prod.appspot.com |
| EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Yes | Firebase Cloud Messaging sender ID | 123456789012 |
| EXPO_PUBLIC_FIREBASE_APP_ID | Yes | Firebase app identifier (iOS) | 1:123456789012:ios:abcdef |

**Configuration File**: `.env` (not committed to git)

```bash
# Backend API
EXPO_PUBLIC_API_URL=https://bananadish-api-xxxxxxxxxx.run.app

# Firebase Configuration (from Firebase Console → Project Settings → Web App)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=bananadish-prod.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=bananadish-prod
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=bananadish-prod.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:ios:abcdef123456
```

**Security Note**: The `EXPO_PUBLIC_` prefix makes these variables available to the client. The Gemini API key must NEVER be prefixed with `EXPO_PUBLIC_` as it would expose the secret in the compiled app bundle.
```

---

### 2. CORS Configuration Section (Design Document)

**Location**: In the "Backend Design (Cloud Run + Node.js)" section, after the "API Endpoints Specification" subsection.

**Action**: Insert new subsection

**Content**:
```markdown
### CORS Configuration

To allow the React Native app to communicate with the Cloud Run backend, CORS (Cross-Origin Resource Sharing) must be properly configured.

**Implementation**:

```javascript
import cors from 'cors';
import express from 'express';

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:19006', // Expo dev server fallback
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours - browser caches preflight response
};

app.use(cors(corsOptions));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// Protected endpoints
app.use('/v1', authMiddleware); // Apply auth to all /v1/* routes
```

**Dependencies**:

Add to `package.json`:
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "@types/cors": "^2.8.17"
  }
}
```

**Environment-Specific Origins**:

- **Development**: `http://localhost:19006` (Expo dev server)
- **Production**: `https://bananadish.app` or `capacitor://localhost` (if using Capacitor)
- **Testing**: Configure test domain in Cloud Run environment variables

**Security Considerations**:

1. **Never use `origin: '*'`** in production - this allows any domain to call your API
2. **Validate origin dynamically** if supporting multiple platforms (iOS, Android, Web)
3. **Use credentials: true** only if sending cookies (not needed for token-based auth but harmless)
4. **Set maxAge** to reduce preflight OPTIONS requests (improves performance)

**Dynamic Origin Validation** (for multi-platform):

```javascript
const allowedOrigins = [
  'http://localhost:19006',           // Expo dev
  'https://bananadish.app',            // Production web
  'capacitor://localhost',             // iOS/Android (if using Capacitor)
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};
```

**Note**: React Native apps typically don't send an `Origin` header, so the `!origin` check allows mobile requests while still protecting against unauthorized web origins.
```

---

### 3. Apple Shared Secret Section (Design Document)

**Location**: In the payment/subscription section, after the Apple IAP integration details.

**Action**: Insert new subsection

**Content**:
```markdown
### Apple Shared Secret Configuration

The **Apple Shared Secret** is required to validate In-App Purchase receipts using Apple's `verifyReceipt` API. This is a critical security component for subscription validation.

#### Obtaining the Shared Secret

1. **Login to App Store Connect**
   - Navigate to https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Access Your App**
   - Click "My Apps"
   - Select "BananaDish" app

3. **Generate Shared Secret**
   - Go to "App Information" (left sidebar)
   - Scroll to "App-Specific Shared Secret" section
   - Click "Manage" or "Generate" if not exists
   - Copy the generated secret (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

4. **Store in Secret Manager**
   ```bash
   # Store the secret securely
   echo -n "YOUR_APPLE_SHARED_SECRET" | gcloud secrets create APPLE_SHARED_SECRET --data-file=-

   # Grant Cloud Run access
   gcloud secrets add-iam-policy-binding APPLE_SHARED_SECRET \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

#### Using the Shared Secret

The shared secret is included in receipt validation requests to Apple:

```typescript
const verifyReceipt = async (receiptData: string): Promise<ReceiptValidationResponse> => {
  const appleSharedSecret = process.env.APPLE_SHARED_SECRET;

  if (!appleSharedSecret) {
    throw new Error('APPLE_SHARED_SECRET not configured');
  }

  // Sandbox URL for testing, Production URL for live app
  const verifyUrl = process.env.NODE_ENV === 'production'
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': appleSharedSecret,
      'exclude-old-transactions': true
    })
  });

  return response.json();
};
```

#### Security Best Practices

1. **Never commit to Git**: Add to `.gitignore`, store only in Secret Manager
2. **App-Specific Secret**: Use app-specific shared secret (not master shared secret) for better security
3. **Rotation**: Apple allows regenerating the secret if compromised
4. **Logging**: Never log the secret value in application logs
5. **Access Control**: Grant Secret Manager access only to Cloud Run service account

#### Testing

- **Sandbox Environment**: Use the same shared secret for both sandbox and production receipt validation
- **Verification**: Test with a sandbox purchase before deploying to production

**CRITICAL**: Without a valid shared secret, all IAP receipt validations will fail, preventing users from purchasing subscriptions.
```

---

### 4. Free Tier Implementation Section (Design Document)

**Location**: In the "Database Design (Firestore)" section, after the user schema definition.

**Action**: Insert new subsection

**Content**:
```markdown
### Free Tier Implementation Details

The Free Tier provides 3 free generations for all new users as a one-time trial. This section details the implementation logic.

#### New User Registration Flow

When a new user signs up (email, Google, or Apple Sign-In), the following Firestore document is created:

```typescript
// Triggered on user creation (Firebase Auth onCreate function or first API call)
const createNewUser = async (uid: string, email: string) => {
  const userRef = db.collection('users').doc(uid);

  await userRef.set({
    email: email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),

    subscription: {
      tier: 'free',                    // Initial tier
      status: 'active',                // Free tier is always "active"
      startDate: admin.firestore.FieldValue.serverTimestamp(),
      renewDate: null,                 // No renewal for free tier
      appleReceiptData: null           // No receipt for free users
    },

    usage: {
      monthlyLimit: 3,                 // ONE-TIME limit (not reset monthly)
      monthlyUsed: 0,
      freeTrialUsed: false,            // Important: tracks if trial exhausted
      resetAt: null,                   // Free tier doesn't reset
      addOnGenerations: 0              // Add-on purchases (if any)
    },

    profile: {
      displayName: email.split('@')[0],
      photoURL: null,
      locale: 'ja'
    }
  });
};
```

#### Generation Request Logic

Before each generation, check the user's quota:

```typescript
const checkQuota = async (uid: string): Promise<boolean> => {
  const userDoc = await db.collection('users').doc(uid).get();
  const user = userDoc.data();

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const { tier } = user.subscription;
  const { monthlyUsed, monthlyLimit, freeTrialUsed } = user.usage;

  // Free tier: Check if trial used up
  if (tier === 'free') {
    if (freeTrialUsed) {
      return false; // Trial exhausted, must upgrade
    }

    if (monthlyUsed >= monthlyLimit) {
      // Mark trial as used
      await db.collection('users').doc(uid).update({
        'usage.freeTrialUsed': true
      });
      return false; // Quota exceeded
    }
  }

  // Starter tier: Check monthly quota
  if (tier === 'starter') {
    if (monthlyUsed >= monthlyLimit) {
      return false; // Monthly quota exceeded
    }
  }

  return true; // Quota available
};
```

#### Incrementing Usage Counter

After successful generation:

```typescript
const incrementUsage = async (uid: string) => {
  await db.collection('users').doc(uid).update({
    'usage.monthlyUsed': admin.firestore.FieldValue.increment(1)
  });
};
```

#### Free Tier Exhausted Flow

When free trial is exhausted (`freeTrialUsed: true`):

1. **Backend Response**:
   ```json
   {
     "error": "QUOTA_EXCEEDED",
     "message": "無料トライアルを使い切りました。Starterプランにアップグレードして月30回生成できます。",
     "tier": "free",
     "freeTrialUsed": true,
     "upgradeOptions": [
       {
         "productId": "com.bananadish.starter.monthly",
         "name": "Starter プラン",
         "price": "¥1,980/月",
         "limit": 30
       }
     ]
   }
   ```

2. **Frontend UI**:
   - Display modal: "無料トライアル終了"
   - Show upgrade benefits (30 generations/month)
   - "アップグレード" button → Navigate to subscription screen
   - "後で" button → Return to home (generation disabled)

#### Upgrade to Starter

When user purchases Starter subscription:

```typescript
const upgradeToStarter = async (uid: string, receiptData: string) => {
  // Validate Apple IAP receipt (see Apple Shared Secret section)
  const validation = await verifyReceipt(receiptData);

  if (validation.status === 0) { // Valid receipt
    const expiresDate = new Date(validation.latest_receipt_info[0].expires_date_ms);

    await db.collection('users').doc(uid).update({
      'subscription.tier': 'starter',
      'subscription.status': 'active',
      'subscription.renewDate': expiresDate,
      'subscription.appleReceiptData': receiptData,
      'usage.monthlyLimit': 30,
      'usage.monthlyUsed': 0,        // Reset usage on upgrade
      'usage.resetAt': expiresDate    // Next reset date
    });
  }
};
```

#### Monthly Reset for Starter Tier

Starter tier quotas reset monthly on the subscription renewal date:

```typescript
// Cloud Function triggered daily to check for resets
const resetMonthlyUsage = async () => {
  const now = admin.firestore.Timestamp.now();

  const usersToReset = await db.collection('users')
    .where('subscription.tier', '==', 'starter')
    .where('usage.resetAt', '<=', now)
    .get();

  const batch = db.batch();

  usersToReset.forEach(doc => {
    const user = doc.data();
    const nextResetDate = new Date(user.usage.resetAt.toDate());
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    batch.update(doc.ref, {
      'usage.monthlyUsed': 0,
      'usage.resetAt': admin.firestore.Timestamp.fromDate(nextResetDate)
    });
  });

  await batch.commit();
};
```

#### Important Notes

1. **Free Tier is ONE-TIME**: Unlike Starter, free tier quota does NOT reset monthly
2. **freeTrialUsed flag**: Once set to `true`, user cannot generate anymore without upgrading
3. **Clear Messaging**: UI must clearly communicate "3 generations total" vs "30 generations per month"
4. **No Partial Usage**: If user generates 3 times, they cannot generate again even if they wait a month (without upgrading)
```

---

### 5. Workplan Document Updates

**Location**: Phase 0 (T003) in the workplan

**Action**: Update the "Development Environment Configuration" task to include the environment variables

**Content Addition**:
```markdown
#### T003: Development Environment Configuration
- **Description**: Set up local development environment and secret management
- **Dependencies**: T001, T002
- **Deliverables**:
  - [ ] Gemini API key obtained and tested
  - [ ] Gemini API key stored in Secret Manager (`GEMINI_API_KEY`)
  - [ ] Apple Shared Secret obtained from App Store Connect
  - [ ] Apple Shared Secret stored in Secret Manager (`APPLE_SHARED_SECRET`)
  - [ ] Firebase service account JSON stored in Secret Manager (`FIREBASE_SERVICE_ACCOUNT`)
  - [ ] Backend `.env` file template created with all required variables (see Environment Variables section in Design Doc)
  - [ ] Frontend `.env` file template created with EXPO_PUBLIC_* variables
  - [ ] `.gitignore` configured to exclude `.env` files
  - [ ] Git repository initialized with `.gitignore` (exclude secrets)
  - [ ] Development machine has all required tools installed
- **Completion Criteria**:
  - Secrets accessible from Cloud Run (test with dummy service)
  - Gemini API test call succeeds
  - Apple Shared Secret stored securely
  - Environment variable templates documented
  - Git repository excludes all sensitive files
- **Verification**:
  ```bash
  # Verify Gemini API key
  gcloud secrets versions access latest --secret="GEMINI_API_KEY"
  curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"

  # Verify Apple Shared Secret
  gcloud secrets versions access latest --secret="APPLE_SHARED_SECRET"

  # Check .env files are ignored
  git status # Should not show .env files
  ```
```

---

## Implementation Steps

1. **Read both target files completely** to understand current structure
2. **Locate exact insertion points** for each section
3. **Insert sections in the correct order** to maintain document flow
4. **Verify markdown formatting** (tables, code blocks, headings)
5. **Check cross-references** (links between sections)
6. **Validate completeness** against the requirements

---

## Verification Checklist

After implementation, verify:

- [ ] Environment Variables section added to design document
- [ ] CORS configuration section added to backend design
- [ ] Apple Shared Secret section added to payment/IAP area
- [ ] Free Tier implementation section added to database design
- [ ] Workplan Task T003 updated with environment variable deliverables
- [ ] All markdown tables properly formatted
- [ ] All code blocks have language specified (```bash, ```javascript, etc.)
- [ ] No broken internal links
- [ ] Section numbering consistent (if applicable)
- [ ] All example values are placeholders (not real secrets)

---

## Dependencies

- Design document must be readable and writable
- Workplan document must be readable and writable
- Understanding of current document structure

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incorrect insertion point | Medium | Read full document first, identify section markers |
| Markdown formatting errors | Low | Use proper code block syntax, validate tables |
| Overwriting existing content | High | Use Edit tool with exact matching, not Write tool |
| Inconsistent terminology | Low | Match existing document terminology (e.g., "Cloud Run" not "GCR") |

---

## Acceptance Criteria

1. All 5 content additions completed successfully
2. No existing content deleted or corrupted
3. Markdown renders correctly (no broken tables/code blocks)
4. Technical accuracy verified (no incorrect API syntax)
5. Consistent with existing documentation style

---

## Notes

- This is a documentation-only task (no code implementation)
- All example API keys and secrets use placeholder values
- Follow the existing documentation style (formal, technical, detailed)
- Maintain consistency with existing section structure
