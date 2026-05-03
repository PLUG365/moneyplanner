import NumericInputModal from "@/components/NumericInputModal";
import { formatMoneyInputDisplay, normalizeMoneyInput } from "@/lib/moneyInput";
import { evaluateMoneyInputForModal } from "@/lib/moneyInputEvaluation";

type MoneyInputModalColors = {
  text: string;
  subText: string;
  background: string;
  card: string;
  border: string;
  tint: string;
};

type MoneyInputModalProps = {
  visible: boolean;
  title: string;
  value: string;
  placeholder: string;
  colors: MoneyInputModalColors;
  allowOperators?: boolean;
  allowNegative?: boolean;
  emptyValue?: number | null;
  useNativeModal?: boolean;
  onChange: (value: string) => void;
  onInvalidExpression?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function MoneyInputModal({
  visible,
  title,
  value,
  placeholder,
  colors,
  allowOperators = false,
  allowNegative = false,
  emptyValue = null,
  useNativeModal = true,
  onChange,
  onInvalidExpression,
  onCancel,
  onConfirm,
}: MoneyInputModalProps) {
  const handleChange = (nextValue: string) => {
    onChange(normalizeMoneyInput(nextValue, { allowOperators, allowNegative }));
  };

  const handleEvaluate = allowOperators
    ? () => {
        const result = evaluateMoneyInputForModal(value, {
          allowNegative,
          emptyValue,
        });
        if (result.kind === "invalid") {
          onInvalidExpression?.();
          return;
        }
        onChange(result.value);
        onConfirm();
      }
    : undefined;

  return (
    <NumericInputModal
      visible={visible}
      title={title}
      value={value}
      displayValue={formatMoneyInputDisplay(value, {
        allowOperators,
        allowNegative,
      })}
      placeholder={placeholder}
      colors={colors}
      allowOperators={allowOperators}
      allowNegative={allowNegative}
      onChange={handleChange}
      onEvaluate={handleEvaluate}
      onCancel={onCancel}
      onConfirm={onConfirm}
      useNativeModal={useNativeModal}
    />
  );
}
