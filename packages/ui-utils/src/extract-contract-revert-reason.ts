export const extractContractRevertReason = (message: string): string => {
  const match = message.match(/Execution reverted with reason:\s*(.*?)\./);
  return match?.[1] ?? message;
};
