type IntentModelRoutingEnv = Partial<NodeJS.ProcessEnv> & {
  EVENTTRIP_INTENT_PRIMARY_MODEL?: string;
  EVENTTRIP_INTENT_FALLBACK_MODEL?: string;
};

function normalizeModelId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveIntentModelIds({
  selectedChatModel,
  env,
}: {
  selectedChatModel: string;
  env: IntentModelRoutingEnv;
}): {
  primaryModelId: string;
  fallbackModelId: string | null;
} {
  const configuredPrimary = normalizeModelId(
    env.EVENTTRIP_INTENT_PRIMARY_MODEL
  );
  const configuredFallback = normalizeModelId(
    env.EVENTTRIP_INTENT_FALLBACK_MODEL
  );

  const primaryModelId = configuredPrimary ?? selectedChatModel;
  const fallbackModelId =
    configuredFallback && configuredFallback !== primaryModelId
      ? configuredFallback
      : null;

  return {
    primaryModelId,
    fallbackModelId,
  };
}
