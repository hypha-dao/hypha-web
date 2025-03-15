import { createStore, createStoreWithProducer } from '@xstate/store';
import { produce } from 'immer';

// Enums and Types
export enum TaskStatus {
  IDLE = 'idle',
  IS_PENDING = 'isPending',
  IS_DONE = 'isDone',
  ERROR = 'error',
}

export type TaskName =
  | 'CREATE_WEB2_SPACE'
  | 'CREATE_WEB3_SPACE'
  | 'GET_WEB3_SPACE_CREATED_EVENT'
  | 'LINK_WEB2_AND_WEB3_SPACE';

export type TaskState = {
  [K in TaskName]: {
    status: TaskStatus;
    message?: string;
  };
};

export type ServiceState = {
  tasks: TaskState;
  progress: number;
  currentAction: string;
  errors: Array<{ taskName: TaskName; message: string }>;
};

// Task descriptions for human-readable action messages
const taskActionDescriptions: Record<TaskName, string> = {
  CREATE_WEB2_SPACE: 'Creating Web2 space...',
  CREATE_WEB3_SPACE: 'Creating Web3 space...',
  GET_WEB3_SPACE_CREATED_EVENT: 'Retrieving Web3 space creation event...',
  LINK_WEB2_AND_WEB3_SPACE: 'Linking Web2 and Web3 spaces...',
};

// Event types
export type StartTaskEvent = {
  type: 'START_TASK';
  taskName: TaskName;
  customActionDescription?: string; // Optional override for the action description
};
export type FinishTaskEvent = { type: 'FINISH_TASK'; taskName: TaskName };
export type ErrorTaskEvent = {
  type: 'ERROR_TASK';
  taskName: TaskName;
  message: string;
};
export type ResetEvent = { type: 'RESET' };

export type ServiceEvent =
  | StartTaskEvent
  | FinishTaskEvent
  | ErrorTaskEvent
  | ResetEvent;

// Initial state definition
const initialTaskState: TaskState = {
  CREATE_WEB2_SPACE: {
    status: TaskStatus.IDLE,
  },
  CREATE_WEB3_SPACE: {
    status: TaskStatus.IDLE,
  },
  GET_WEB3_SPACE_CREATED_EVENT: {
    status: TaskStatus.IDLE,
  },
  LINK_WEB2_AND_WEB3_SPACE: {
    status: TaskStatus.IDLE,
  },
};

export const initialState: ServiceState = {
  tasks: initialTaskState,
  progress: 0,
  currentAction: '',
  errors: [],
};

/**
 * Computes the overall progress percentage based on the current state of tasks
 * @param tasks The current task state
 * @returns A number between 0 and 100 representing the progress percentage
 */
const computeProgress = (tasks: TaskState): number => {
  const taskList = Object.values(tasks);
  const totalTasks = taskList.length;

  if (totalTasks === 0) return 0;

  // Count completed tasks
  const completedTasks = taskList.filter(
    (task) => task.status === TaskStatus.IS_DONE,
  ).length;

  // Count in-progress tasks (contribute half a task to progress)
  const inProgressTasks =
    taskList.filter((task) => task.status === TaskStatus.IS_PENDING).length *
    0.5;

  // Calculate progress percentage
  const progress = ((completedTasks + inProgressTasks) / totalTasks) * 100;

  // Round to nearest integer and ensure it's between 0 and 100
  return Math.min(100, Math.max(0, Math.round(progress)));
};

// Create the service store with event handlers
export const serviceStore = createStoreWithProducer(produce, {
  context: initialState,
  on: {
    START_TASK: (context, event: StartTaskEvent) => {
      // Direct mutation with Immer
      context.tasks[event.taskName].status = TaskStatus.IS_PENDING;

      // Set the current action based on the task name or use custom description if provided
      context.currentAction =
        event.customActionDescription || taskActionDescriptions[event.taskName];

      // Update progress
      context.progress = computeProgress(context.tasks);
    },

    FINISH_TASK: (context, event: FinishTaskEvent) => {
      // Direct mutation with Immer
      context.tasks[event.taskName].status = TaskStatus.IS_DONE;

      // If all tasks are complete, clear the current action
      const isAllComplete = Object.values(context.tasks).every(
        (task) =>
          task.status === TaskStatus.IS_DONE ||
          task.status === TaskStatus.ERROR,
      );

      // Update progress and current action if all complete
      context.progress = computeProgress(context.tasks);
      if (isAllComplete) {
        context.currentAction = 'All tasks completed';
      }
    },

    ERROR_TASK: (context, event: ErrorTaskEvent) => {
      // Direct mutation with Immer
      context.tasks[event.taskName].status = TaskStatus.ERROR;
      context.tasks[event.taskName].message = event.message;

      // Update progress
      context.progress = computeProgress(context.tasks);

      // Update current action
      context.currentAction = `Error in ${taskActionDescriptions[
        event.taskName
      ].replace('...', '')}: ${event.message}`;

      // Add to errors array
      context.errors.push({ taskName: event.taskName, message: event.message });
    },

    RESET: () => initialState,
  },
});

// Helper functions for dispatching events
export const startTask = (
  taskName: TaskName,
  customActionDescription?: string,
): void => {
  serviceStore.send({
    type: 'START_TASK',
    taskName,
    customActionDescription,
  });
};

export const finishTask = (taskName: TaskName): void => {
  serviceStore.send({ type: 'FINISH_TASK', taskName });
};

export const errorTask = (taskName: TaskName, message: string): void => {
  serviceStore.send({ type: 'ERROR_TASK', taskName, message });
};

export const resetService = (): void => {
  serviceStore.send({ type: 'RESET' });
};

// Helper to subscribe to state changes
export const subscribeToServiceState = (
  callback: (state: ServiceState) => void,
) => {
  return serviceStore.subscribe((snapshot) => {
    callback(snapshot.context as ServiceState);
  });
};

// Helper to get current state
export const getServiceState = (): ServiceState => {
  return serviceStore.getSnapshot().context as ServiceState;
};

// Helper to get a specific task state
export const getTaskState = (
  taskName: TaskName,
): {
  status: TaskStatus;
  message?: string;
} => {
  const state = getServiceState();
  return state.tasks[taskName];
};

// Check if all tasks are complete
export const areAllTasksComplete = (): boolean => {
  const state = getServiceState();
  return Object.values(state.tasks).every(
    (task) => task.status === TaskStatus.IS_DONE,
  );
};

// Check if any task has an error
export const hasAnyTaskError = (): boolean => {
  const state = getServiceState();
  return Object.values(state.tasks).some(
    (task) => task.status === TaskStatus.ERROR,
  );
};
