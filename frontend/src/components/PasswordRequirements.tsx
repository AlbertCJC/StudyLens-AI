import React from "react";
import { Check, X } from "lucide-react";
import { PASSWORD_RULES, passwordRuleStates } from "../utils/password";

interface PasswordRequirementsProps {
  password: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  const states = passwordRuleStates(password);
  const touched = password.length > 0;

  return (
    <div className="space-y-1 mt-2">
      {PASSWORD_RULES.map((rule) => {
        const met = states[rule.key];
        return (
          <div key={rule.key} className="flex items-center gap-1.5">
            {touched && met ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            )}
            <span
              className={
                touched && met
                  ? "text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-[11px] font-medium text-slate-400 dark:text-slate-500"
              }
            >
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
