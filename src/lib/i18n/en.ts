export const en = {
  appName: 'NEPAL RESCUE',
  appTagline: 'Emergency Rescue Coordination Platform',
  disclaimer:
    'Prototype emergency coordination service. Not an official emergency service. Submitting a request does not guarantee rescue. If possible, contact official emergency services directly.',
  officialNumbersHeading: 'Official Nepal Emergency Hotlines:',

  actions: {
    requestRescue: 'REQUEST RESCUE',
    checkExisting: 'CHECK EXISTING REQUEST',
    useMyLocation: 'USE MY CURRENT LOCATION',
    selectOnMap: 'SELECT LOCATION ON MAP',
    enterDescription: 'ENTER LOCATION DESCRIPTION',
    next: 'Next',
    previous: 'Previous',
    submit: 'SUBMIT RESCUE REQUEST',
    submitting: 'Submitting Request...',
    backToHome: 'Back to Home',
    retry: 'Retry Submission',
  },

  steps: {
    step1Title: '1. Location',
    step1Prompt: 'We need your location to help responders find you.',
    step2Title: '2. People',
    step2Prompt: 'How many people need help?',
    step3Title: '3. Immediate Danger',
    step3Prompt: 'What is your current situation?',
    step4Title: '4. Injury Status',
    step4Prompt: 'Is anyone injured?',
    step5Title: '5. Disaster Type',
    step5Prompt: 'What type of emergency or hazard is it?',
    step6Title: '6. Additional Details',
    step6Prompt: 'Describe your current surroundings and situation (optional):',
    step7Title: '7. Contact Info',
    step7Prompt: 'Phone number where responders can reach you (strongly recommended):',
  },

  status: {
    locationDetected: 'Location detected',
    accuracy: 'Accuracy',
    meters: 'metres',
    approximateWarning: 'Your location is approximate. Responders will also rely on your text description.',
    gpsFailed: 'GPS could not acquire coordinates automatically. Please describe your location manually below.',
    submitting: 'Connecting to emergency coordination server...',
    savedLocally: 'Request saved locally on your device. Waiting for connection...',
    requestReceived: 'RESCUE REQUEST RECEIVED',
    mandatoryNotice:
      'Your request has been recorded. It has NOT necessarily been received or accepted by a rescue team.',
    caseIdLabel: 'Case ID',
    caseTokenLabel: 'Verification Token (Save this!)',
  },

  tracking: {
    title: 'Track Rescue Request',
    enterCaseId: 'Enter Case ID (e.g., NR-2026-000184)',
    enterToken: 'Enter Verification Token',
    checkStatus: 'Check Status',
    currentStatus: 'Current Status',
    submittedAt: 'Submitted At',
    lastUpdate: 'Last Status Update',
  },
};

export type TranslationKey = typeof en;
