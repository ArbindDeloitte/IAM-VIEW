// Capability -> provision map.
// Each IAM component is split into capabilities; each capability links to the specific part of the law it answers.
// 'primary' = a main way IAM meets that provision. 'supporting' = adds evidence or reduces risk.

export const PROVISION_GROUPS = [
  { id: 'security', label: 'Security safeguards · S8(5)' },
  { id: 'breach', label: 'Breach · S8(6)' },
  { id: 'children', label: 'Children and guardians · S9' },
  { id: 'rights', label: 'Principal rights · S11-S14' },
  { id: 'consent', label: 'Consent and purpose · S5-S7' },
  { id: 'quality', label: 'Data quality · S8(3)' },
];

export const PROVISIONS = [
  { id: 'r6b', group: 'security', ref: 'Rule 6(1)(b)', label: 'Control access to computer resources', ob: 'access-logging' },
  { id: 'r6c', group: 'security', ref: 'Rule 6(1)(c)', label: 'Visibility on access: logs, monitoring, review', ob: 'access-logging' },
  { id: 'r6e', group: 'security', ref: 'Rule 6(1)(e) · 8(3)', label: 'Keep logs and data for one year', ob: 'access-logging' },
  { id: 'r6f', group: 'security', ref: 'Rule 6(1)(f) · S8(2)', label: 'Security terms for processors', ob: 'vendor-access' },
  { id: 'r7a', group: 'breach', ref: 'Rule 7(1)', label: 'Tell principals without delay, e.g. via their user account', ob: 'breach' },
  { id: 'r7b', group: 'breach', ref: 'Rule 7(2)', label: 'Tell the Board, then report within 72 hours', ob: 'breach' },
  { id: 'r10', group: 'children', ref: 'S9(1) · Rule 10', label: 'Verifiable parental consent', ob: 'parental-consent' },
  { id: 'r11', group: 'children', ref: 'S9(1) · Rule 11', label: 'Guardian of a person with a disability', ob: 'guardian-verification' },
  { id: 'r14a', group: 'rights', ref: 'Rule 14(1), (5)', label: 'Identify the requester by an identifier', ob: 'rights-auth' },
  { id: 'r14d', group: 'rights', ref: 'S14 · Rule 14(4)', label: 'Nominee acts on death or incapacity', ob: 'nominee' },
  { id: 's12', group: 'rights', ref: 'S8(7) · S12', label: 'Correct, update and erase', ob: 'erasure' },
  { id: 's6w', group: 'consent', ref: 'S6(4)-(6)', label: 'Withdraw consent as easily as giving it', ob: 'consent-withdrawal' },
  { id: 's6cm', group: 'consent', ref: 'S6(7)-(9) · Rule 4', label: 'Consent Managers', ob: 'consent-managers' },
  { id: 's6p', group: 'consent', ref: 'S6(10)', label: 'Prove notice and consent', ob: 'proof-of-consent' },
  { id: 's5', group: 'consent', ref: 'S5-S7', label: 'Process only for the consented purpose', ob: 'purpose-access' },
  { id: 's83', group: 'quality', ref: 'S8(3)', label: 'Complete, accurate, consistent data', ob: 'data-accuracy' },
];

const P = 'primary';
const S = 'supporting';

export const CAPABILITIES = [
  // Access management
  { id: 'am-sso', control: 'AM', name: 'SSO and federation', does: 'One authenticated session across apps, and federation to partners and Consent Managers.', links: [
    ['r6b', P, 'Central, enforceable login in front of every application that holds personal data.'],
    ['s6cm', S, "Federation ties a Consent Manager's requests to an authenticated principal."],
  ] },
  { id: 'am-mfa', control: 'AM', name: 'Multi-factor authentication', does: 'A second factor for staff, administrators and data principals.', links: [
    ['r6b', P, 'Blocks stolen-password access to systems holding personal data.'],
    ['r14a', P, 'Step-up proves the requester is the principal before a rights request is actioned.'],
  ] },
  { id: 'am-adaptive', control: 'AM', name: 'Risk-based access', does: 'Decides per login using device, location and behaviour.', links: [
    ['r6b', S, 'Tightens access when signals look risky.'],
    ['r6c', S, 'Produces risk signals that feed monitoring.'],
  ] },
  { id: 'am-session', control: 'AM', name: 'Session control and revocation', does: 'Short sessions, forced logout and instant token revocation.', links: [
    ['r6b', P, 'Ends access immediately when someone leaves or a breach is suspected.'],
    ['s6w', S, 'Can cut off access that depended on withdrawn consent.'],
  ] },

  // Directory services
  { id: 'ds-dir', control: 'DS', name: 'Authoritative directory and attribute sync', does: 'One trusted source for identity attributes, synchronised downstream.', links: [
    ['s83', P, 'Keeps identity attributes complete, accurate and consistent.'],
    ['s12', S, 'A correction made once flows to every connected system.'],
  ] },
  { id: 'ds-graph', control: 'DS', name: 'Single identity view', does: "Links a person's accounts across systems.", links: [
    ['s12', S, "Finds a person's accounts and records when a request arrives."],
    ['r14a', S, 'Matches the requester to one identity.'],
  ] },

  // Authorization
  { id: 'az-policy', control: 'AZ', name: 'Fine-grained policy (RBAC / ABAC)', does: 'Central policies decide who may do what to which data.', links: [
    ['r6b', P, 'Consistent least-privilege decisions in every application.'],
    ['r6c', S, 'Policy decision logs show why access was granted.'],
  ] },
  { id: 'az-purpose', control: 'AZ', name: 'Purpose-based access', does: 'Policies that check a purpose tag on the data before allowing use.', links: [
    ['s5', P, 'Stops data being used for a purpose the person never agreed to (needs purpose tagging first).'],
    ['s6w', S, 'Can block use of data whose consent has been withdrawn.'],
  ] },
  { id: 'az-delegate', control: 'AZ', name: 'Delegated and relationship-based access', does: "Models 'acts on behalf of' relationships such as a guardian or nominee.", links: [
    ['r14d', P, 'Lets a nominee act within a limited scope.'],
    ['r11', S, "Represents a guardian's authority over a person's account."],
  ] },

  // Identity governance
  { id: 'iga-jml', control: 'IGA', name: 'Joiner-mover-leaver automation', does: 'Grants, changes and removes access from HR events.', links: [
    ['r6b', P, 'Leavers lose access the same day, so no orphaned accounts hold personal data.'],
    ['s83', S, 'HR-sourced attributes keep identity data consistent.'],
    ['s12', S, 'Deprovisioning removes the identity itself when erasure applies.'],
  ] },
  { id: 'iga-review', control: 'IGA', name: 'Access reviews and certification', does: 'Managers periodically confirm who should keep which access.', links: [
    ['r6b', P, 'Removes excess access to personal data on a schedule.'],
    ['r6c', S, 'Evidence that access is reviewed, as the rule asks.'],
  ] },
  { id: 'iga-sod', control: 'IGA', name: 'Role design and separation of duties', does: 'Role models and conflict rules for entitlements.', links: [
    ['r6b', S, 'Limits access to what each role needs.'],
    ['s5', S, 'Roles can encode which purpose a person may process data for.'],
  ] },
  { id: 'iga-3p', control: 'IGA', name: 'Third-party identity lifecycle', does: 'Sponsors, onboards and expires contractor and vendor identities.', links: [
    ['r6f', P, 'Vendor and processor staff get sponsored, time-boxed access.'],
    ['r6b', S, 'Keeps external accounts inside the same access rules.'],
  ] },

  // Privileged access
  { id: 'pam-vault', control: 'PAM', name: 'Credential vaulting and rotation', does: 'Stores admin and service credentials and rotates them automatically.', links: [
    ['r6b', P, 'No shared or standing admin passwords on systems holding personal data.'],
    ['r6f', S, 'Lets you hand processors vaulted, expiring credentials.'],
  ] },
  { id: 'pam-jit', control: 'PAM', name: 'Just-in-time elevation', does: 'Admin rights granted per task and expired afterwards.', links: [
    ['r6b', P, 'Cuts standing privileged access to data stores.'],
  ] },
  { id: 'pam-record', control: 'PAM', name: 'Session recording and audit', does: 'Records what privileged users did, command by command.', links: [
    ['r6c', P, 'Direct visibility on who accessed personal data and what they did.'],
    ['r6e', S, 'Recordings are logs that can be retained for a year.'],
  ] },
  { id: 'pam-vendor', control: 'PAM', name: 'Vendor and remote privileged access', does: 'Brokered, monitored access for third parties without handing out credentials.', links: [
    ['r6f', P, "Turns a processor's contractual safeguards into enforced controls."],
    ['r6b', S, 'Restricts external access to named systems.'],
  ] },

  // Threat detection
  { id: 'itdr-detect', control: 'ITDR', name: 'Identity-based threat detection', does: 'Flags credential abuse, token theft and lateral movement.', links: [
    ['r6c', P, 'Monitoring of access to catch unauthorised use.'],
    ['r7b', S, 'Helps the fiduciary become aware of a breach and scope it.'],
  ] },
  { id: 'itdr-contain', control: 'ITDR', name: 'Automated containment', does: 'Disables accounts, revokes tokens and forces resets on detection.', links: [
    ['r7b', S, 'Limits breach impact while the 72-hour report is prepared.'],
  ] },

  // Cloud entitlements
  { id: 'ciem-right', control: 'CIEM', name: 'Cloud entitlement right-sizing', does: 'Finds and trims excess cloud permissions.', links: [
    ['r6b', P, 'Limits who and what can reach cloud-hosted personal data.'],
    ['r6f', S, 'Scopes processor roles inside your cloud accounts.'],
  ] },

  // Identity verification
  { id: 'idv-proof', control: 'IDV', name: 'Document and biometric verification', does: 'Checks a government document and matches the face to it.', links: [
    ['r10', P, 'Confirms the parent is an identifiable adult.'],
    ['r11', P, 'Confirms who the guardian is.'],
    ['r14d', S, 'Verifies the nominee before they act.'],
  ] },
  { id: 'idv-live', control: 'IDV', name: 'Liveness and age estimation', does: 'Detects spoofing and estimates age without a full ID.', links: [
    ['r10', S, 'Gives an age signal to decide who needs parental consent.'],
  ] },
  { id: 'idv-recover', control: 'IDV', name: 'Identity-proofed recovery', does: 'Re-verifies a person before resetting access.', links: [
    ['r14a', S, 'Stops account recovery being used to hijack a rights request.'],
  ] },

  // Decentralised credentials
  { id: 'dvc-vc', control: 'DVC', name: 'Verifiable credentials and wallets', does: 'Signed claims held by the person and shown on demand.', links: [
    ['r10', P, "A parent shows a verifiable 'adult' credential instead of an ID copy."],
    ['r11', S, 'Guardian status can be carried as a credential.'],
    ['s6cm', S, 'Credentials link consent artefacts to a real principal.'],
  ] },
  { id: 'dvc-token', control: 'DVC', name: 'Reusable identity and age tokens', does: 'Tokens mapped to verified identity and age, issued by an authorised entity.', links: [
    ['r10', P, 'Matches the virtual-token route the rule describes (for example Digital Locker).'],
  ] },
  { id: 'dvc-zkp', control: 'DVC', name: 'Zero-knowledge age proof', does: "Proves 'over 18' without revealing who you are.", links: [
    ['r10', S, 'Meets the check while limiting the data collected.'],
  ] },

  // Passwordless
  { id: 'pwl-passkey', control: 'PWL', name: 'Passkeys and FIDO2', does: 'Phishing-resistant sign-in with no shared secret.', links: [
    ['r6b', P, 'Removes phishing and credential stuffing from the access path.'],
    ['r14a', P, 'Strong proof that the requester controls the account.'],
  ] },
  { id: 'pwl-hw', control: 'PWL', name: 'Hardware security keys for admins', does: 'Physical keys for privileged users.', links: [
    ['r6b', S, 'Protects the highest-risk accounts.'],
  ] },

  // Consent and privacy
  { id: 'cpm-receipt', control: 'CPM', name: 'Consent receipts', does: 'Records what was consented to, when, and under which notice version.', links: [
    ['s6p', P, 'Gives the evidence the fiduciary must produce if consent is questioned.'],
    ['s5', S, 'Records the purpose attached to each consent.'],
  ] },
  { id: 'cpm-withdraw', control: 'CPM', name: 'Preference centre and withdrawal', does: 'Lets people view and withdraw consent as easily as they gave it.', links: [
    ['s6w', P, 'Provides the easy withdrawal route and triggers the stop.'],
  ] },
  { id: 'cpm-cm', control: 'CPM', name: 'Consent Manager integration', does: 'Exchanges consent artefacts with registered Consent Managers.', links: [
    ['s6cm', P, 'Lets principals manage consent across fiduciaries from one place.'],
  ] },
  { id: 'cpm-portal', control: 'CPM', name: 'Data-principal request portal', does: 'An authenticated place to file access, correction and erasure requests.', links: [
    ['r14a', P, 'Publishes the request channel and the identifier used to find the person.'],
    ['s12', S, 'Captures and tracks the request that triggers correction or erasure.'],
    ['r7a', S, 'A verified account and contact is one channel for breach notices.'],
  ] },

  // Secrets
  { id: 'sm-vault', control: 'SM', name: 'Secrets vaulting and rotation', does: 'Keeps keys, tokens and API secrets out of code and rotates them.', links: [
    ['r6b', P, 'Stops embedded keys giving direct access to data stores.'],
    ['r6f', S, 'Processors and apps get short-lived secrets.'],
  ] },
  { id: 'sm-api', control: 'SM', name: 'Machine and API identity governance', does: 'Inventory and expiry for service accounts and API keys.', links: [
    ['r6b', S, 'Controls machine access to personal data.'],
    ['r6c', S, 'Attributes API calls to an owner for audit.'],
  ] },

  // Analytics
  { id: 'iai-anom', control: 'IAI', name: 'Access analytics and anomaly detection', does: 'Baselines normal access and flags outliers.', links: [
    ['r6c', P, 'Review of access patterns to spot misuse.'],
  ] },
  { id: 'iai-audit', control: 'IAI', name: 'Audit trail and evidence reporting', does: 'Tamper-evident access logs and ready-made reports.', links: [
    ['r6e', P, 'Retains the logs the rule requires.'],
    ['r6c', S, 'Supports review and investigation.'],
    ['s6p', S, 'Shows who consented and from which session.'],
  ] },
  { id: 'iai-mining', control: 'IAI', name: 'Role mining and entitlement clean-up', does: 'Finds unused or excessive entitlements.', links: [
    ['r6b', S, 'Shrinks access to what is actually used.'],
  ] },
];
