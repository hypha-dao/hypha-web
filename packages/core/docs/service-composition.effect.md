# Service Composition Patterns

This document outlines elegant patterns for composing multiple services and managing complex workflows in TypeScript/JavaScript applications, with a focus on using Effect for robust service composition.

## Table of Contents

- [Core Patterns](#core-patterns)
  - [Effect-based Pipeline](#effect-based-pipeline)
  - [Result Pattern](#result-pattern)
  - [Progress Tracking](#progress-tracking)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)

## Core Patterns

### Effect-based Pipeline

Instead of using raw Promises, we can leverage Effect's powerful composition and error handling capabilities:

```typescript
import { Effect, pipe } from '@effect/core';
import * as Schedule from '@effect/core/Schedule';

type ServiceCommand<TInput, TOutput, E = Error> = {
  execute: (input: TInput) => Effect<TOutput, E>;
  rollback?: (input: TInput, error: E) => Effect<void, never>;
};

class EffectPipeline<TInput, TOutput, E = Error> {
  private steps: ServiceCommand<any, any, E>[] = [];

  addStep<TNext>(command: ServiceCommand<TOutput, TNext, E>) {
    this.steps.push(command);
    return this as unknown as EffectPipeline<TInput, TNext, E>;
  }

  execute(input: TInput): Effect<TOutput, E> {
    return pipe(
      Effect.succeed(input),
      Effect.flatMap((initialValue) => this.steps.reduce((effect, step) => Effect.flatMap(effect, step.execute), Effect.succeed(initialValue) as Effect<any, E>)),
    );
  }

  // Add retry capability
  withRetry(schedule: Schedule.Schedule<never, E, any>) {
    return new EffectPipeline(
      this.steps.map((step) => ({
        ...step,
        execute: (input: any) => Effect.retry(step.execute(input), schedule),
      })),
    );
  }
}
```

#### Key Benefits

- Full type safety with Effect's type system
- Built-in error handling and retry mechanisms
- Composable and chainable operations
- Resource safety guarantees
- Concurrent execution capabilities

### Result Pattern

With Effect, we can leverage its built-in error handling instead of custom Result types:

```typescript
import { Effect, pipe } from '@effect/core';

// Instead of Result<T, E>
type ServiceEffect<T, E = Error> = Effect<T, E>;

const handleService = <T, E>(effect: ServiceEffect<T, E>) =>
  pipe(
    effect,
    Effect.catchAll(
      (error) =>
        // Handle error gracefully
        Effect.logError(error) as ServiceEffect<T, E>,
    ),
    Effect.withSpan('service-operation'), // Built-in tracing
  );
```

### Progress Tracking

Effect provides built-in observability features we can leverage:

```typescript
import { Effect, Metric } from '@effect/core';

class ObservableEffectPipeline<TInput, TOutput, E = Error> extends EffectPipeline<TInput, TOutput, E> {
  private stepCounter = Metric.counter('pipeline_steps_total');
  private stepDuration = Metric.histogram('pipeline_step_duration_seconds');

  execute(input: TInput): Effect<TOutput, E> {
    return pipe(
      super.execute(input),
      Effect.tap(() => Effect.increment(this.stepCounter)),
      Effect.timed,
      Effect.tap(([duration]) => Effect.update(this.stepDuration, duration)),
      Effect.map(([_, result]) => result),
    );
  }
}
```

## Implementation Examples

### Basic Service Orchestration

Here's how to orchestrate services using Effect:

```typescript
import { Effect, pipe } from '@effect/core';
import * as Schedule from '@effect/core/Schedule';

type SpaceCreationContext = {
  web2Space?: Web2Space;
  web3Space?: Web3Space;
  transactionHash?: string;
};

class SpaceOrchestrator {
  private pipeline: EffectPipeline<CreateSpaceInput, SpaceCreationContext>;

  constructor(web2Service: Web2Service, web3Service: Web3Service) {
    this.pipeline = new EffectPipeline()
      .addStep({
        execute: (input) =>
          pipe(
            Effect.all([web2Service.createSpace(input), web3Service.createSpace(input)]),
            Effect.map(([web2Space, web3Result]) => ({
              web2Space,
              transactionHash: web3Result.hash,
            })),
          ),
      })
      .addStep({
        execute: (context) =>
          pipe(
            web3Service.waitForSpaceCreation(context.transactionHash!),
            Effect.map((web3Space) => ({ ...context, web3Space })),
          ),
      })
      .withRetry(Schedule.exponential(1000, 2)); // Exponential backoff retry
  }

  createSpace(input: CreateSpaceInput): Effect<SpaceCreationContext, Error> {
    return pipe(
      this.pipeline.execute(input),
      Effect.withSpan('create-space'), // Tracing
      Effect.timeoutFail(5000, () => new Error('Operation timed out')),
      Effect.tapError((error) => Effect.logError('Space creation failed', error)),
    );
  }
}
```

### React Hook Integration

Integration with React using Effect:

```typitten
import { Effect, Runtime } from "@effect/core"
import { useEffect, useState } from "react"

export const useServiceOrchestrator = (services: Services) => {
  const [state, setState] = useState<{
    progress: number;
    currentStep?: string;
    error?: Error;
  }>({ progress: 0 });

  const runtime = Runtime.make();

  const orchestrator = useMemo(() => {
    const pipeline = new ObservableEffectPipeline()
      // ... pipeline configuration
      .onProgress((progress) =>
        setState(prev => ({ ...prev, progress }))
      );

    return new SpaceOrchestrator(pipeline);
  }, [services]);

  const runOperation = useCallback((input: CreateSpaceInput) => {
    return runtime.runPromise(
      pipe(
        orchestrator.createSpace(input),
        Effect.tap((result) => Effect.sync(() =>
          setState(prev => ({ ...prev, progress: 100 }))
        ))
      )
    );
  }, [orchestrator, runtime]);

  return {
    runOperation,
    ...state
  };
};
```

## Best Practices

1. **Effect Composition**

   - Use `pipe` for clear and readable effect chains
   - Leverage Effect's built-in operators for composition
   - Use `Effect.all` for parallel execution

2. **Error Handling**

   - Use Effect's error channel for typed errors
   - Implement retries using Schedule
   - Use `Effect.catchAll` for comprehensive error handling

3. **Resource Management**

   - Use `Effect.acquireRelease` for resource safety
   - Implement proper cleanup in error cases
   - Use Effect's scoping for resource lifetime management

4. **Observability**

   - Use Effect's built-in metrics
   - Implement tracing with `Effect.withSpan`
   - Use structured logging with `Effect.log`

5. **Performance**

   - Use `Effect.all` for concurrent operations
   - Implement proper timeouts
   - Use Effect's fiber system for background operations

6. **Type Safety**
   - Leverage Effect's type system
   - Use branded types for additional type safety
   - Maintain proper error typing

## Conclusion

Effect provides a powerful foundation for building robust service composition patterns. Its key advantages include:

- Powerful error handling and retry mechanisms
- Built-in observability and metrics
- Resource safety guarantees
- Concurrent execution capabilities
- Type-safe operations
- Excellent developer experience

Choose Effect when you need:

- Complex service orchestration
- Robust error handling
- Resource management
- High performance
- Type safety
- Observability

[Effect Documentation](https://effect.website/docs) provides comprehensive information about these features and more.
