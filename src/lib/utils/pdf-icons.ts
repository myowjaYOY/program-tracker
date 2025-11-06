/**
 * MUI Icon SVG paths for PDF generation
 * Extracted from @mui/icons-material for inline SVG rendering
 * All icons use 24x24 viewBox
 */

export interface IconSvg {
  path: string;
  viewBox?: string;
}

/**
 * MSQ Body System Icons
 */
export const msqDomainIcons: Record<string, IconSvg> = {
  head: {
    // Psychology icon - brain/head
    path: 'M13 3C9.25 3 6.2 5.94 6.02 9.64L4.1 12.2C3.85 12.53 3.76 12.99 3.86 13.42C3.96 13.85 4.25 14.2 4.66 14.38L6.3 15.2V16.5C6.3 17.6 7.2 18.5 8.3 18.5H9V21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V18.5H15.7C16.8 18.5 17.7 17.6 17.7 16.5V15.2L19.34 14.38C19.75 14.2 20.04 13.85 20.14 13.42C20.24 12.99 20.15 12.53 19.9 12.2L17.98 9.64C17.8 5.94 14.75 3 11 3H13M11.99 14.08C9.48 14.08 7.33 15.66 6.45 17.88C6.04 16.68 5.8 15.38 5.8 14.08C5.8 8.56 10.07 4.05 15.54 3.95C15.18 5.55 14.19 6.9 12.82 7.63C10.64 8.79 9.3 11.06 9.3 13.58C9.3 13.75 9.32 13.91 9.33 14.08H11.99Z',
  },
  eyes: {
    // Visibility icon
    path: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  },
  ears: {
    // Hearing icon
    path: 'M17 20c-.29 0-.56-.06-.76-.15-.71-.37-1.21-.88-1.71-2.38-.51-1.56-1.47-2.29-2.39-3-.79-.61-1.61-1.24-2.32-2.53C9.29 10.98 9 9.93 9 9c0-2.8 2.2-5 5-5s5 2.2 5 5h2c0-3.93-3.07-7-7-7S7 5.07 7 9c0 1.26.38 2.65 1.07 3.9.91 1.65 1.98 2.48 2.85 3.15.81.62 1.39 1.07 1.71 2.05.6 1.82 1.37 2.84 2.73 3.55.51.23 1.07.35 1.64.35 2.21 0 4-1.79 4-4h-2c0 1.1-.9 2-2 2zM7.64 2.64L6.22 1.22C4.23 3.21 3 5.96 3 9s1.23 5.79 3.22 7.78l1.41-1.41C6.01 13.74 5 11.49 5 9s1.01-4.74 2.64-6.36zM11.5 9c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5h-2c0 .28-.22.5-.5.5s-.5-.22-.5-.5h-2z',
  },
  nose: {
    // Air icon (best available for nose/breathing)
    path: 'M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3zM19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5zm-.5 4.5H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2c1.93 0 3.5-1.57 3.5-3.5S20.43 11 18.5 11z',
  },
  mouth_throat: {
    // RecordVoiceOver icon (speaking/throat)
    path: 'M9 9m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z',
  },
  digestive_tract: {
    // Restaurant icon
    path: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  },
  heart: {
    // Favorite icon (heart)
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  lungs: {
    // WindPower icon (breathing/air flow)
    path: 'M4 3h6v2H4zm0 4h6v2H4zm0 4h6v2H4zM4 3h6v2H4zm10.293.707L12.879 5.12 11.464 3.707 12.879 2.293zm3.414 3.414L16.293 8.536 14.878 7.12l1.415-1.414zM19 11h-2v2h2zm-2.293 3.707l-1.414 1.414-1.414-1.414 1.414-1.414zM14.5 21l1.5-1.5L14.5 18l-1.5 1.5zm-5-5L11 17.5 9.5 19 8 17.5zM5 21l1.5-1.5L5 18l-1.5 1.5zM2 14.5L3.5 16 2 17.5.5 16z',
  },
  joints_muscle: {
    // FitnessCenter icon (strength/muscle)
    path: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
  },
  skin: {
    // Spa icon (wellness/skin care)
    path: 'M15.49 9.63c-.18-2.79-1.31-5.51-3.43-7.63-2.14 2.14-3.32 4.86-3.55 7.63 1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm6.42-.25c-.13.09-.27.16-.4.26.13-.1.27-.17.4-.26zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z',
  },
  energy_activity: {
    // Bolt icon (energy)
    path: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  },
  mind: {
    // Psychology icon (same as head - mental/cognitive)
    path: 'M13 3C9.25 3 6.2 5.94 6.02 9.64L4.1 12.2C3.85 12.53 3.76 12.99 3.86 13.42C3.96 13.85 4.25 14.2 4.66 14.38L6.3 15.2V16.5C6.3 17.6 7.2 18.5 8.3 18.5H9V21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V18.5H15.7C16.8 18.5 17.7 17.6 17.7 16.5V15.2L19.34 14.38C19.75 14.2 20.04 13.85 20.14 13.42C20.24 12.99 20.15 12.53 19.9 12.2L17.98 9.64C17.8 5.94 14.75 3 11 3H13M11.99 14.08C9.48 14.08 7.33 15.66 6.45 17.88C6.04 16.68 5.8 15.38 5.8 14.08C5.8 8.56 10.07 4.05 15.54 3.95C15.18 5.55 14.19 6.9 12.82 7.63C10.64 8.79 9.3 11.06 9.3 13.58C9.3 13.75 9.32 13.91 9.33 14.08H11.99Z',
  },
  emotions: {
    // SentimentSatisfied icon (happy/emotions)
    path: 'M15.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M8.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-4c-1.48 0-2.75-.81-3.45-2H6.88c.8 2.05 2.79 3.5 5.12 3.5s4.32-1.45 5.12-3.5h-1.67c-.7 1.19-1.97 2-3.45 2z',
  },
  weight: {
    // Scale icon (weight measurement)
    path: 'M12 3c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z M8 12.5h8v-1H8v1z',
  },
  other: {
    // Assignment icon (clipboard/notes)
    path: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  },
};

/**
 * PROMIS Domain Icons
 */
export const promisDomainIcons: Record<string, IconSvg> = {
  physical_function: {
    // DirectionsRun icon
    path: 'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
  },
  anxiety: {
    // MoodBad icon
    path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
  },
  depression: {
    // SentimentVeryDissatisfied icon
    path: 'M11.99 2C6.47 2 2 6.47 2 12s4.47 10 9.99 10S22 17.53 22 12 17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm4.18-12.24l-1.06 1.06-1.06-1.06L13 8.82l1.06 1.06L13 10.94 14.06 12l1.06-1.06L16.18 12l1.06-1.06-1.06-1.06 1.06-1.06zM7.82 12l1.06-1.06L9.94 12 11 10.94 9.94 9.88 11 8.82 9.94 7.76 8.88 8.82 7.82 7.76 6.76 8.82l1.06 1.06-1.06 1.06zM12 14c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z',
  },
  fatigue: {
    // Bedtime icon
    path: 'M9.27 4.49c-1.63.49-3.04 1.48-4.06 2.82C4.1 9.08 3.5 11.46 4.09 14c.59 2.54 2.22 4.66 4.49 5.81 2.27 1.16 4.96 1.37 7.38.61.05-.02.09-.03.14-.05-2.36-.83-4.26-2.64-5.15-4.99-.89-2.35-.67-5.01.72-7.11.1-.14.2-.28.3-.41-.62-.13-1.25-.2-1.89-.2-.63 0-1.25.08-1.85.23.01 0 .02 0 .04.01zm10.43 2.14l.63-.93.91-.59-.91-.59-.63-.93-.64.93-.91.59.91.59.64.93zm-6.19-1.45l.39-.58.57-.37-.57-.38-.39-.58-.4.58-.57.38.57.37.4.58z',
  },
  sleep_disturbance: {
    // NightsStay icon (moon/night/sleep)
    path: 'M11.1 12.08c-2.33-4.51-.5-8.48.53-10.07C6.27 2.2 1.98 6.59 1.98 12c0 .14.02.28.02.42.62-.27 1.29-.42 2-.42 1.66 0 3.18.83 4.1 2.15 1.67-.75 3.65-.54 5.13.67.83-.92 1.29-2.12 1.29-3.38 0-1.14-.38-2.21-1.06-3.07-.24.2-.46.42-.66.66-1.76 2.09-2.37 4.78-1.79 7.05zm8.37-1.78l1.59-3.5 3.47-1.61-3.47-1.6-1.59-3.51-1.59 3.51-3.48 1.6 3.48 1.61 1.59 3.5z',
  },
  social_roles: {
    // People icon
    path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  },
  pain_interference: {
    // LocalHospital icon
    path: 'M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',
  },
  pain_intensity: {
    // Bolt icon (intensity/severity)
    path: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  },
};

/**
 * UI/Decorative Icons
 */
export const uiIcons: Record<string, IconSvg> = {
  stats: {
    // Assessment icon (stats/scores)
    path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  },
  trending: {
    // TrendingUp icon
    path: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  },
  search: {
    // Search icon
    path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  },
  calendar: {
    // CalendarToday icon
    path: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
  },
  hospital: {
    // LocalHospital icon
    path: 'M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',
  },
  book: {
    // MenuBook icon
    path: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  },
  pin: {
    // PushPin icon
    path: 'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z',
  },
  lock: {
    // Lock icon
    path: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  },
  report: {
    // Description icon (document/report)
    path: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  },
  // Member Progress specific icons
  timer: {
    // AccessTime icon (timer/clock)
    path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  },
  surveys: {
    // Assignment icon (clipboard/surveys)
    path: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  },
  scale: {
    // MonitorWeight icon (scale/weight)
    path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zm-9-6.5c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm3 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm3 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z',
  },
  curriculum: {
    // School icon (education/curriculum)
    path: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  },
  play: {
    // PlayArrow icon (next/play)
    path: 'M8 5v14l11-7z',
  },
  checkmark: {
    // CheckCircle icon (completed/success)
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  warning: {
    // Warning icon (overdue/alert)
    path: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  },
  energy: {
    // Bolt icon (energy/power)
    path: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  },
  mood: {
    // SentimentSatisfied icon (mood/emotions)
    path: 'M15.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M8.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-4c-1.48 0-2.75-.81-3.45-2H6.88c.8 2.05 2.79 3.5 5.12 3.5s4.32-1.45 5.12-3.5h-1.67c-.7 1.19-1.97 2-3.45 2z',
  },
  motivation: {
    // DirectionsRun icon (motivation/movement)
    path: 'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
  },
  wellbeing: {
    // Favorite icon (wellbeing/heart)
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  sleep: {
    // Bedtime icon (sleep/rest)
    path: 'M9.27 4.49c-1.63.49-3.04 1.48-4.06 2.82C4.1 9.08 3.5 11.46 4.09 14c.59 2.54 2.22 4.66 4.49 5.81 2.27 1.16 4.96 1.37 7.38.61.05-.02.09-.03.14-.05-2.36-.83-4.26-2.64-5.15-4.99-.89-2.35-.67-5.01.72-7.11.1-.14.2-.28.3-.41-.62-.13-1.25-.2-1.89-.2-.63 0-1.25.08-1.85.23.01 0 .02 0 .04.01zm10.43 2.14l.63-.93.91-.59-.91-.59-.63-.93-.64.93-.91.59.91.59.64.93zm-6.19-1.45l.39-.58.57-.37-.57-.38-.39-.58-.4.58-.57.38.57.37.4.58z',
  },
  nutrition: {
    // Restaurant icon (nutrition/food)
    path: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  },
  supplements: {
    // Medication icon (supplements/pills)
    path: 'M4.22 11.29l7.07-7.07c.78-.78 2.05-.78 2.83 0l4.95 4.95c.78.78.78 2.05 0 2.83l-7.07 7.07c-.78.78-2.05.78-2.83 0L4.22 14.12c-.78-.78-.78-2.05 0-2.83zM16 6l-4-4-1.41 1.41L13.17 6H10v2h3.17l-2.58 2.59L12 12l4-4 1.41 1.41L20 6.83V10h2V3.5L16 6zM7 17.5l3.5-3.5 3.5 3.5-3.5 3.5z',
  },
  exercise: {
    // FitnessCenter icon (exercise/gym)
    path: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
  },
  meditation: {
    // SelfImprovement icon (meditation/mindfulness)
    path: 'M12 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 4c-1.1 0-2 .9-2 2v5H8.5v7h7v-7H14v-5c0-1.1-.9-2-2-2zm7.5 3c0-1.66-1.34-3-3-3-.62 0-1.18.19-1.66.5l1.11 1.11c.16-.05.32-.11.55-.11 1.1 0 2 .9 2 2 0 .23-.06.39-.11.55l1.11 1.11c.31-.48.5-1.04.5-1.66zm-15 0c0 .62.19 1.18.5 1.66l1.11-1.11c-.05-.16-.11-.32-.11-.55 0-1.1.9-2 2-2 .23 0 .39.06.55.11l1.11-1.11c-.48-.31-1.04-.5-1.66-.5-1.66 0-3 1.34-3 3z',
  },
  goal: {
    // TrackChanges icon (goals/target)
    path: 'M19.07 4.93l-1.41 1.41C19.1 7.79 20 9.79 20 12c0 4.42-3.58 8-8 8s-8-3.58-8-8c0-4.08 3.05-7.44 7-7.93v2.02C8.16 6.57 6 9.03 6 12c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24l-1.41 1.41C15.55 9.89 16 10.9 16 12c0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86v2.14c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V2h-1C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-2.76-1.12-5.26-2.93-7.07z',
  },
  streak: {
    // Whatshot icon (streak/fire)
    path: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  },
  trophy: {
    // EmojiEvents icon (trophy/win)
    path: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM7 10.82C5.84 10.4 5 9.3 5 8V7h2v3.82zM19 8c0 1.3-.84 2.4-2 2.82V7h2v1z',
  },
};

/**
 * Helper function to generate inline SVG with proper styling
 */
export function generateIconSvg(
  icon: IconSvg,
  options: {
    size?: number;
    color?: string;
    style?: string;
  } = {}
): string {
  const { size = 16, color = 'currentColor', style = '' } = options;
  const viewBox = icon.viewBox || '0 0 24 24';

  return `<svg xmlns="http://www.w3.org/2000/svg" style="width: ${size}px; height: ${size}px; vertical-align: middle; display: inline-block; ${style}" viewBox="${viewBox}" fill="${color}"><path d="${icon.path}"/></svg>`;
}

/**
 * MSQ Domain Color Mapping (logical colors matching body system)
 */
const msqDomainColors: Record<string, string> = {
  head: '#8b5cf6',           // Purple - brain/mind
  eyes: '#3b82f6',           // Blue - vision
  ears: '#06b6d4',           // Cyan - hearing
  nose: '#10b981',           // Green - breathing/air
  mouth_throat: '#ec4899',   // Pink - voice/communication
  digestive_tract: '#f59e0b', // Orange - digestive
  heart: '#ef4444',          // Red - cardiovascular
  lungs: '#6366f1',          // Indigo - respiratory
  joints_muscle: '#84cc16',  // Lime - strength/movement
  skin: '#a855f7',           // Purple-pink - wellness
  energy_activity: '#eab308', // Yellow - energy
  mind: '#7c3aed',           // Deep purple - mental/cognitive
  emotions: '#f97316',       // Orange-red - emotions
  weight: '#14b8a6',         // Teal - metabolism
  other: '#6b7280',          // Gray - general
};

/**
 * PROMIS Domain Color Mapping (logical colors matching health state)
 */
const promisDomainColors: Record<string, string> = {
  physical_function: '#84cc16', // Lime - movement/activity
  anxiety: '#f59e0b',           // Orange - anxiety/stress
  depression: '#6366f1',        // Indigo - mood
  fatigue: '#eab308',           // Yellow - energy
  sleep_disturbance: '#8b5cf6', // Purple - sleep/night
  social_roles: '#06b6d4',      // Cyan - social/connection
  pain_interference: '#ef4444', // Red - pain
  pain_intensity: '#dc2626',    // Dark red - severe pain
};

/**
 * Get icon for MSQ domain with logical color
 */
export function getMsqDomainIcon(domainKey: string, options?: Parameters<typeof generateIconSvg>[1]): string {
  const icon = msqDomainIcons[domainKey] ?? msqDomainIcons.other!;
  const color = msqDomainColors[domainKey] ?? msqDomainColors.other!;
  return generateIconSvg(icon, { color, ...options });
}

/**
 * Get icon for PROMIS domain with logical color
 */
export function getPromisDomainIcon(domainKey: string, options?: Parameters<typeof generateIconSvg>[1]): string {
  const icon = promisDomainIcons[domainKey] ?? uiIcons.stats!;
  const color = promisDomainColors[domainKey] ?? '#6b7280';
  return generateIconSvg(icon, { color, ...options });
}

/**
 * Get UI icon
 */
export function getUiIcon(iconKey: string, options?: Parameters<typeof generateIconSvg>[1]): string {
  const icon = uiIcons[iconKey] ?? uiIcons.stats!;
  return generateIconSvg(icon, options);
}

