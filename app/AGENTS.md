# Mobile development

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Keep mobile work in this folder. Do not modify client/ or server/ without a
concrete compatibility requirement. Read README.md and VALIDATION.md first.
Use Expo-compatible native packages, semantic theme tokens and thin route files.
Never copy backend secrets or financial business logic into the mobile client.
Validate with npm run typecheck, npm run lint and Expo Doctor. Native changes
also need a physical-device development build. Do not commit generated android/.
