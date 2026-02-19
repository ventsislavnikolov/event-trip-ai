export type PackageTier = "Budget" | "Best Value" | "Premium";

export type PackageOptionInput = {
  id: string;
  ticketPrice: number;
  flightPrice: number;
  hotelPrice: number;
  qualityScore: number;
  currency: string;
};

export type RankedPackageOption = PackageOptionInput & {
  tier: PackageTier;
  totalPrice: number;
  withinBudget: boolean;
  overBudgetAmount: number;
  selectionReason: string;
};

export type RankedPackageResult = {
  tiers: RankedPackageOption[];
};

type RankingOptions = {
  maxBudgetPerPerson?: number;
};

type NormalizedPackageOption = PackageOptionInput & {
  totalPrice: number;
};

function calculateTotalPrice(option: PackageOptionInput): number {
  return option.ticketPrice + option.flightPrice + option.hotelPrice;
}

function sortByPriceAsc(options: NormalizedPackageOption[]) {
  return [...options].sort((a, b) => {
    if (a.totalPrice !== b.totalPrice) {
      return a.totalPrice - b.totalPrice;
    }

    return a.id.localeCompare(b.id);
  });
}

function sortByQualityDesc(options: NormalizedPackageOption[]) {
  return [...options].sort((a, b) => {
    if (a.qualityScore !== b.qualityScore) {
      return b.qualityScore - a.qualityScore;
    }

    if (a.totalPrice !== b.totalPrice) {
      return b.totalPrice - a.totalPrice;
    }

    return a.id.localeCompare(b.id);
  });
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function selectPremiumOption(
  options: NormalizedPackageOption[],
  excludedIds: Set<string>
): NormalizedPackageOption | undefined {
  const available = options.filter((option) => !excludedIds.has(option.id));
  if (available.length === 0) {
    return undefined;
  }

  const medianPrice = median(options.map((option) => option.totalPrice));
  const outlierUpperBound = medianPrice > 0 ? medianPrice * 2 : Number.POSITIVE_INFINITY;

  const nonOutliers = available.filter(
    (option) => option.totalPrice <= outlierUpperBound
  );

  const premiumPool = nonOutliers.length > 0 ? nonOutliers : available;
  return sortByQualityDesc(premiumPool)[0];
}

function selectBestValueOption(
  options: NormalizedPackageOption[],
  excludedIds: Set<string>
): NormalizedPackageOption | undefined {
  const available = options.filter((option) => !excludedIds.has(option.id));
  if (available.length === 0) {
    return undefined;
  }

  return [...available]
    .sort((a, b) => {
      const aScore = a.qualityScore / a.totalPrice;
      const bScore = b.qualityScore / b.totalPrice;

      if (aScore !== bScore) {
        return bScore - aScore;
      }

      if (a.totalPrice !== b.totalPrice) {
        return a.totalPrice - b.totalPrice;
      }

      return a.id.localeCompare(b.id);
    })
    .at(0);
}

function toRankedOption({
  option,
  tier,
  maxBudgetPerPerson,
  selectionReason,
}: {
  option: NormalizedPackageOption;
  tier: PackageTier;
  maxBudgetPerPerson?: number;
  selectionReason: string;
}): RankedPackageOption {
  const withinBudget =
    maxBudgetPerPerson === undefined ? true : option.totalPrice <= maxBudgetPerPerson;
  const overBudgetAmount = withinBudget
    ? 0
    : Math.round((option.totalPrice - (maxBudgetPerPerson ?? option.totalPrice)) * 100) /
      100;

  return {
    ...option,
    tier,
    withinBudget,
    overBudgetAmount,
    selectionReason,
  };
}

export function rankPackageOptions(
  options: PackageOptionInput[],
  { maxBudgetPerPerson }: RankingOptions = {}
): RankedPackageResult {
  if (options.length === 0) {
    return { tiers: [] };
  }

  const normalizedOptions = options.map((option) => ({
    ...option,
    totalPrice: calculateTotalPrice(option),
  }));

  const sortedByPrice = sortByPriceAsc(normalizedOptions);
  const budgetOption = sortedByPrice[0];

  const selectedIds = new Set<string>([budgetOption.id]);
  const bestValueOption =
    selectBestValueOption(normalizedOptions, selectedIds) ?? budgetOption;
  selectedIds.add(bestValueOption.id);

  const premiumOption =
    selectPremiumOption(normalizedOptions, selectedIds) ??
    sortByQualityDesc(normalizedOptions)[0] ??
    bestValueOption;

  return {
    tiers: [
      toRankedOption({
        option: budgetOption,
        tier: "Budget",
        maxBudgetPerPerson,
        selectionReason: "Lowest total trip price.",
      }),
      toRankedOption({
        option: bestValueOption,
        tier: "Best Value",
        maxBudgetPerPerson,
        selectionReason: "Best quality-to-price ratio.",
      }),
      toRankedOption({
        option: premiumOption,
        tier: "Premium",
        maxBudgetPerPerson,
        selectionReason: "Highest quality option within sane price bounds.",
      }),
    ],
  };
}
