`Project Requirements rules *@docs/project-requirements.md* You will use tools codebase to know what are the details of the files of this *@docs/project-requirements.md* directory files to check the project requirements and the project standards that you need to follow. This will be the guide for you to make sure you are following the project standards. So make sure to read this when planning and implementing the project to avoid duplications, conflicts, and errors. Don't touch that folder and files, you will only read it. Don't over do it to the point that you are not following the project requirements. DON'T REMOVE THIS LINE 1!!!!`


# Accounting Website Project Requirements

## Core Features
1. **Calculation Engine**
   - Financial ratio analysis
   - Depreciation calculations (straight-line & reducing balance)
   - Tax computations
   - Break-even analysis
   - Cash flow projections

2. **Financial Statement Generator**
   - Balance sheet templates
   - Income statement builder
   - Cash flow statement wizard
   - Custom report creation

3. **Realtime Collaboration**
   - Multi-user editing
   - Version control
   - Change tracking
   - Audit trails

4. **Data Management**
   - CSV/Excel import/export
   - Cloud sync capabilities
   - Data validation rules
   - Historical data comparison

## Technical Specifications
**Frontend:**
- Mobile first approach
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Shadcn UI
- Recharts (data visualization)
- Math.js (calculations)
- Zustand (state management)
- Framer motion (animation)

**Backend:**
- Next.js API routes
- Supabase (PostgreSQL Database)
- Supabase Auth
- Supabase Realtime
- Supabase Storage (for files)
- Prisma ORM (optional)
- Zod (validation)

**Key Integrations:**
- Tax rates: Supabase Edge Functions (self-contained)
- Currency rates: Supabase PostgreSQL extensions
- PDF export: Supabase Storage + React-PDF
- CSV handling: Supabase Import/Export

## Security Requirements
1. AES-256 encryption for data at rest
2. TLS 1.3 for data in transit
3. Role-based access control (RBAC)
4. Activity logging & audit trails
5. SOC 2 compliance (Future Phase)

## Compliance Requirements
- GAAP/IFRS compliance checks
- Tax regulation updates
- Data retention policies
- Accessibility (WCAG 2.1 AA)
- GDPR-ready architecture

## Documentation Standards
1. Inline TSDoc comments for all calculations
2. OpenAPI specification for APIs
3. ER diagrams for database schema
4. Audit trail documentation
5. Financial formula registry

## Project Roadmap (Updated Implementation Sequence)

### Phase 1 - Core Accounting Features (2-3 weeks)
**Implementation Order**:
1. **Project Infrastructure Setup** (1 day)
   - Supabase initialization
   - Next.js boilerplate with TypeScript
   - Core component structure
   - Error boundary setup

2. **Calculation Engine Foundation** (5 days)
   - [ ] Math.js integration
   - [ ] Depreciation calculator (straight-line)
   - [ ] Financial ratio formulas
   - [ ] Calculation validation system
   - [ ] Unit test setup

3. **Financial Statement Templates** (4 days)
   - [ ] Balance sheet component
   - [ ] Income statement builder
   - [ ] PDF export functionality
   - [ ] Data validation schemas

4. **Local Data Management** (3 days)
   - [ ] Local storage integration
   - [ ] Data encryption setup
   - [ ] Historical versioning
   - [ ] CSV export (basic)

5. **UI/UX Foundation** (3 days)
   - [ ] Mobile-first responsive layout
   - [ ] Accessible form components
   - [ ] Data visualization (Recharts)
   - [ ] Dark mode support
   - [ ] Loading/error states

6. **Basic Security** (2 days)
   - [ ] Input sanitization
   - [ ] Audit logging
   - [ ] Rate limiting
   - [ ] Error boundaries

### Phase 2 - Data Management (1-2 weeks)
**Priority**: ★★★☆☆
**Implementation Order**:
1. **Authentication System** (3 days)
   - [ ] Supabase auth setup
   - [ ] User profile management
   - [ ] Session management
   - [ ] Basic RBAC roles

2. **Cloud Data Migration** (4 days)
   - [ ] Supabase database schema
   - [ ] Local → Cloud migration tool
   - [ ] Data encryption at rest
   - [ ] Conflict resolution

3. **Advanced CSV Handling** (3 days)
   - [ ] Bulk import/export
   - [ ] Data validation rules
   - [ ] Template system
   - [ ] Error reporting

### Phase 3 - Collaboration Features (2 weeks)
**Priority**: ★★☆☆☆
**Implementation Order**:
1. **Realtime Foundation** (3 days)
   - [ ] Supabase Realtime setup
   - [ ] Presence indicators
   - [ ] Basic co-editing
   - [ ] Connection status

2. **Version Control** (4 days)
   - [ ] Change tracking
   - [ ] Version history
   - [ ] Snapshot system
   - [ ] Rollback functionality

3. **Collaboration Tools** (3 days)
   - [ ] Comments system
   - [ ] @mentions
   - [ ] Notifications
   - [ ] Activity feed

------`don't read and implement this phase 4, this is just for you to know the future features that we will implement`------
### Phase 4 - Advanced Features (Optional)
**Priority**: ★☆☆☆☆
**Implementation Order**:
1. **Bank Integrations** (5 days)
   - [ ] Plaid sandbox setup
   - [ ] Transaction import
   - [ ] Reconciliation tools
   - [ ] Webhook handlers

2. **Multi-currency** (3 days)
   - [ ] Exchange rate system
   - [ ] Currency converter
   - [ ] Localization
   - [ ] FX gain/loss calc

3. **Automation** (4 days)
   - [ ] Tax rule engine
   - [ ] Scheduled reports
   - [ ] Compliance checks
   - [ ] Audit trails

4. **Advanced Reporting** (3 days)
   - [ ] Custom templates
   - [ ] Data visualization
   - [ ] Executive dashboards
   - [ ] Export formats

------`don't read and implement this phase 4, this is just for you to know the future features that we will implement`------

## Cost Analysis
| Feature          | Supabase Service         | Free Tier Limits              |
|------------------|--------------------------|-------------------------------|
| Database         | PostgreSQL               | 500MB database + 1GB bandwidth|
| Auth             | Authentication           | 50k MAUs                      |
| Realtime         | Realtime Updates         | 50 concurrent connections     |
| Storage          | File Storage             | 1GB storage, 1M downloads     |
| Edge Functions   | Serverless Functions     | 500k invocations/month        |
| Vector           | PostgreSQL Extensions    | Free with database            |

## Implementation Benefits
1. Single provider for all backend needs
2. Unified authentication system
3. Direct database <> storage integration
4. Simplified billing and monitoring
5. Built-in rate limiting and security

## Architecture Guidelines

### 1. Modular Structure
```
src/
├── app/               # Next.js app router
├── components/        # Reusable UI components
│   ├── core/          # Base components (buttons, inputs)
│   ├── accounting/    # Domain-specific components
│   └── shared/       # Cross-feature components
├── lib/
│   ├── api/           # API clients
│   ├── hooks/         # Custom hooks
│   ├── utils/         # Helper functions
│   └── validation/    # Zod schemas
├── types/             # Global TS types
```

### 2. Server/Client Separation
- **Server Components**: Default to server components for:
  - Data fetching
  - Sensitive operations
  - Static content
- **Client Components**: Only use when needed for:
  - Interactivity
  - Browser APIs
  - State management

### 3. Reusable Components
1. Create atomic components with:
   - PropTypes using TypeScript interfaces
   - Storybook stories for documentation
   - Accessibility attributes by default
2. Follow naming convention:
   - `FeatureComponentName.tsx` (e.g. `DepreciationCalculator.tsx`)
   - `CoreComponentName.tsx` (e.g. `FormInput.tsx`)

### 4. API Design Rules
- Versioned endpoints: `/api/v1/...`
- RESTful structure for resources
- Error format standardization:
  ```ts
  interface APIError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
  ```
