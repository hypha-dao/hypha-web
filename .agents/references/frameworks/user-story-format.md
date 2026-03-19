### User Story Format

#### Story Template

```
As a [user persona],
I want [capability/action],
So that [benefit/outcome].
```

#### Acceptance Criteria (Given-When-Then)

```
Given [precondition/context],
When [action is taken],
Then [expected outcome].
```

#### Example

**Title:** Password Reset via Email

**Story:**

> As a registered user,
> I want to reset my password via email,
> So that I can regain access to my account if I forget my credentials.

**Acceptance Criteria:**

1. Given I am on the login page, when I click "Forgot Password," then I see an email input form.
2. Given I enter a registered email, when I submit the form, then I receive a reset link within 2 minutes.
3. Given I click the reset link, when the link is less than 24 hours old, then I can set a new password.
4. Given the reset link is expired, when I click it, then I see an error with option to request a new link.
