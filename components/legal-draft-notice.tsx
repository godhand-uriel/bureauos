import { Callout } from "@/components/callout";

/**
 * Shown on every legal page until counsel has reviewed it. Lists the
 * decisions the text deliberately does not make on the owner's behalf.
 */
export function LegalDraftNotice({ openItems }: { openItems: string[] }) {
  return (
    <Callout variant="warning" title="Draft — pending attorney review">
      <p>
        This document describes how Building202 actually works today, in plain language. It has not yet
        been reviewed by a lawyer and may change before it is final.
      </p>
      {openItems.length > 0 && (
        <>
          <p className="mt-2">Still to be decided by Building202 and its counsel:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {openItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </Callout>
  );
}
