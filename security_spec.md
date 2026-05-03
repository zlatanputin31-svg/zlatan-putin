# Security Specification: ExamPilot AI

## 1. Data Invariants
- A user document can only be created by the authenticated user with matching UID.
- Question history must always be associated with the authenticated user.
- Statistics documents are private to the user.

## 2. The "Dirty Dozen" Payloads (Denial Proofing)
1. **Identity Spoofing**: Attempt to create a user document with someone else's UID. (PERMISSION_DENIED)
2. **Access Escalation**: Attempt to read another user's question history. (PERMISSION_DENIED)
3. **Invalid Exam Type**: Attempt to set `examType` to "CFA" (not in enum). (PERMISSION_DENIED)
4. **Massive Question**: Attempt to save a 2MB question text. (PERMISSION_DENIED)
5. **Timestamp Forge**: Attempt to set `timestamp` to a future date instead of `request.time`. (PERMISSION_DENIED)
6. **Field Injection**: Adding `isAdmin: true` to a user profile. (PERMISSION_DENIED)
7. **Cross-User Leak**: Querying for all history without a user constraint. (PERMISSION_DENIED)
8. **Stat Modification**: Attempt to manually increment points without solving a question (if logic moves to server, but here client side for now, so we need strict field validation).
9. **History Orphan**: Creating history in a path that doesn't match the user's UID. (PERMISSION_DENIED)
10. **Topic Type Poisoning**: Sending an object instead of a string for `topic`. (PERMISSION_DENIED)
11. **Malicious ID**: Creating a document with ID `../../secrets`. (PERMISSION_DENIED)
12. **Unverified Auth**: Accessing resources with `email_verified == false`. (PERMISSION_DENIED)

## 3. Test Runner (Draft)
The `firestore.rules` will be validated against these scenarios.
