# Account approval (Spark / no billing required)

In Firebase Console > Firestore Database > Data > users, open the document
whose ID is the Firebase Authentication UID of the applicant. Check its email.
Edit the string field status to approved or rejected. Save. Pending is the default.
Approved enables access; pending/rejected disables access immediately on the next
server update. An offline client cannot receive revocation until it reconnects.
Data already seen by an approved user cannot be recalled from their device.

Only Console/IAM administrators can change these documents. An approved app user
cannot approve themselves or anybody else. This uses Firestore Security Rules,
not only a hidden screen. Existing unlisted collections are denied.

Authentication's Disabled switch is separate. To remove data access from an
existing account, change status to rejected as well; disabling sign-in alone
does not instantly invalidate all previously issued ID tokens.

If a user has not signed in to this version yet, their users document might not
exist. Use their UID from Authentication and create a users document with their
email, displayName, uid and status; the app creates pending documents automatically.
