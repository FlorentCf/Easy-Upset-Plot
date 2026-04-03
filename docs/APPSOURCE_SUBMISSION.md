# AppSource Submission Checklist

Easy UpSet Plot is close to AppSource-ready, but Microsoft submission still requires publisher-provided assets and listing content.

## Already In The Repository

- Packaged `.pbiviz` visual
- Public source code and README
- MIT license
- Support URL pointing to GitHub issues
- Author name and contact email in `pbiviz.json`
- Native selection support
- Native highlight-data support through matrix mapping
- Landing/onboarding state and in-visual guide

## You Still Need To Provide

- A working Partner Center publisher account
- A sample `.pbix` file that works offline
- A 300x300 PNG marketplace logo
- 1 to 5 screenshots at exactly 1366x768
- A support page or support workflow you are comfortable exposing publicly
- A privacy policy URL
- A EULA URL or confirmation that you will use the standard Microsoft contract
- Marketplace listing text:
  - short description
  - long description
  - features
  - categories
  - search keywords

## Recommended Final Checks

- Test in Power BI Desktop
- Test in Power BI Service
- Test high contrast mode
- Test keyboard-only navigation
- Test import/upgrade on a clean `.pbix`
- Confirm the packaged visual name, publisher, icon, and support URL
- Confirm that all screenshots match the final shipped UI and naming

## Suggested Submission Assets

- Screenshot 1: default exact mode with guide visible
- Screenshot 2: inclusive mode with a business-friendly explanation
- Screenshot 3: selection and overlap tooltip behavior
- Screenshot 4: formatting pane controls
- Screenshot 5: dense real-world example showing performance

## Notes

- Keep the GUID stable for updates. Microsoft explicitly warns not to change the GUID when resubmitting an updated visual.
- The internal GUID is intentionally unchanged so existing reports can keep upgrading cleanly.
