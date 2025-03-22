# Service Composition Patterns

This document outlines elegant patterns for composing multiple services and managing complex workflows in TypeScript/JavaScript applications.

## Table of Contents

- [Core Patterns](#core-patterns)
  - [Command Pattern with Pipeline](#command-pattern-with-pipeline)
  - [Result Monad Pattern](#result-monad-pattern)
  - [Progress Tracking](#progress-tracking)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)

## Core Patterns

### Command Pattern with Pipeline

The Command Pattern with Pipeline allows for flexible composition of service operations while maintaining clean separation of concerns.

```typescript
type ServiceCommand<TInput, TOutput> = {
  execute: (input: TInput) => Promise<TOutput>;
  rollback?: (input: TInput, error: Error) => Promise<void>;
};

class ServicePipeline<TInput, TOutput> {
  private steps: ServiceCommand<any, any>[] = [];

  addStep<TNext>(command: ServiceCommand<TOutput, TNext>) {
    this.steps.push(command);
    return this as unknown as ServicePipeline<TInput, TNext>;
  }

  async execute(input: TInput): Promise<TOutput> {
    return this.steps.reduce(async (promise, step) => step.execute(await promise), Promise.resolve(input) as Promise<any>);
  }
}
```

#### Key Benefits

- Modular and composable service operations
- Type-safe execution chain
- Easy to add or remove steps
- Support for rollback operations

### Result Monad Pattern

The Result Monad Pattern provides a clean way to handle success and error states throughout the service pipeline.

```typescript
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

class ServiceResult<T> {
  constructor(private readonly value: Result<T>) {}

  map<U>(fn: (value: T) => Promise<U>): Promise<ServiceResult<U>> {
    if (!this.value.success) {
      return Promise.resolve(new ServiceResult(this.value));
    }
    return fn(this.value.data)
      .then((data) => new ServiceResult({ success: true, data }))
      .catch((error) => new ServiceResult({ success: false, error }));
  }
}
```

#### Key Benefits

- Clear error handling
- Chain operations safely
- Preserve error context
- Type-safe error handling

### Progress Tracking

Integrate progress tracking into your service pipeline for better user feedback.

```typescript
type ProgressTracker = {
  onStepStart: (step: string) => void;
  onStepComplete: (step: string) => void;
  onStepError: (step: string, error: Error) => void;
};

class TrackedServicePipeline<TInput, TOutput> extends ServicePipeline<TInput, TOutput> {
  constructor(private tracker: ProgressTracker) {
    super();
  }

  async execute(input: TInput): Promise<TOutput> {
    let result = input;
    for (const [index, step] of this.steps.entries()) {
      const stepName = `Step ${index + 1}`;
      this.tracker.onStepStart(stepName);
      try {
        result = await step.execute(result);
        this.tracker.onStepComplete(stepName);
      } catch (error) {
        this.tracker.onStepError(stepName, error as Error);
        throw error;
      }
    }
    return result as TOutput;
  }
}
```

## Implementation Examples

### Basic Service Orchestration

Here's an example of orchestrating multiple services with context sharing:

```typescript
type SpaceCreationContext = {
  web2Space?: Web2Space;
  web3Space?: Web3Space;
  transactionHash?: string;
};

class SpaceOrchestrator {
  private pipeline: ServicePipeline<CreateSpaceInput, SpaceCreationContext>;

  constructor(web2Service: Web2Service, web3Service: Web3Service) {
    this.pipeline = new ServicePipeline()
      .addStep({
        execute: async (input) => {
          const [web2Space, web3Result] = await Promise.all([web2Service.createSpace(input), web3Service.createSpace(input)]);
          return { web2Space, transactionHash: web3Result.hash };
        },
      })
      .addStep({
        execute: async (context) => {
          const web3Space = await web3Service.waitForSpaceCreation(context.transactionHash!);
          return { ...context, web3Space };
        },
      })
      .addStep({
        execute: async (context) => {
          const linkedSpace = await web2Service.linkSpaces(context.web2Space!.slug, context.web3Space!.id);
          return { ...context, web2Space: linkedSpace };
        },
      });
  }

  async createSpace(input: CreateSpaceInput) {
    return this.pipeline.execute(input);
  }
}
```

### React Hook Integration

Example of integrating with React hooks:

```typescript
export const useServiceOrchestrator = (services: Services) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>();

  const orchestrator = useMemo(() => {
    const tracker: ProgressTracker = {
      onStepStart: (step) => setCurrentStep(step),
      onStepComplete: (step) => {
        setProgress((prev) => prev + 100 / totalSteps);
        setCurrentStep(undefined);
      },
      onStepError: (step, error) => {
        setCurrentStep(undefined);
        // Handle error
      },
    };

    return new ServiceOrchestrator(services, tracker);
  }, [services]);

  return {
    orchestrator,
    progress,
    currentStep,
  };
};
```

## Best Practices

1. **Single Responsibility**

   - Each service command should do one thing well
   - Keep pipeline steps focused and atomic

2. **Error Handling**

   - Use the Result Monad for predictable error flows
   - Implement rollback mechanisms for critical operations
   - Preserve error context for debugging

3. **State Management**

   - Use immutable state updates
   - Pass context between steps explicitly
   - Avoid shared mutable state

4. **Testing**

   - Test each service command in isolation
   - Mock dependencies for pipeline testing
   - Test error scenarios and rollbacks

5. **Progress Tracking**

   - Provide meaningful step names
   - Track progress granularly
   - Handle errors gracefully

6. **Type Safety**
   - Leverage TypeScript's type system
   - Define clear interfaces for inputs and outputs
   - Use generics for flexible yet type-safe implementations

## Conclusion

These service composition patterns provide a robust foundation for building complex workflows while maintaining code quality and developer experience. They are especially useful for:

- Multi-step operations
- Parallel service execution
- Error handling and recovery
- Progress tracking
- State management
- Testing and maintenance

Choose and adapt these patterns based on your specific use case and requirements.
