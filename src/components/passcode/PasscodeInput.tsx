import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function PasscodeInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange} autoFocus={autoFocus}>
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}