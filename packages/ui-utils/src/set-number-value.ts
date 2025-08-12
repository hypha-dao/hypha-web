import type { FieldValues, Path } from 'react-hook-form';

export const handleNumberChange = <
  TFieldValues extends FieldValues = FieldValues,
>(
  setValue: (valueName: string, value: any) => void,
  valueName: Path<TFieldValues>,
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      setValue(valueName, '');
      return;
    }
    const val = Number(e.target.value);
    const num = Number.isNaN(val) ? 0 : val;
    setValue(valueName, num);
  };
};
