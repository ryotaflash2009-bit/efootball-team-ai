/**
 * 日本語辞書（既定言語）。既存の画面表示と完全に一致させる（第三者の変更前後で文言が変わらないようにする）。
 * キー構造は `en.ts` と完全に一致させること（`scripts/audit-i18n-keys.mjs` で機械検証する）。
 *
 * `Dictionary` はここで構造（キー名＋値は string）だけを定義する。`as const` は使わない
 * （値をリテラル型にすると、英語辞書が「同じ日本語の文字列」しか代入できなくなってしまうため）。
 */
export interface Dictionary {
  common: {
    loading: string;
    errorTitle: string;
    errorDescription: string;
    retry: string;
    back: string;
    home: string;
    save: string;
    cancel: string;
    close: string;
    confirm: string;
    unknownPlayer: string;
  };
  pageError: {
    title: string;
    description: string;
    codeLabelPrefix: string;
    iconAriaLabel: string;
  };
  notFoundPage: {
    title: string;
    description: string;
    playersLink: string;
  };
  homePage: {
    heroBadge: string;
    heroTitlePrefix: string;
    heroTitleAccent: string;
    heroTitleSuffix: string;
    heroDescriptionTemplate: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    searchButton: string;
    compareButton: string;
    createSquadButton: string;
    dataStatusHeading: string;
    worldCardsLabel: string;
    efhubIndexLabel: string;
    managersLabel: string;
    syncedAtLabel: string;
    worldUnavailableTitle: string;
    worldUnavailableCommandPrefix: string;
    worldUnavailableCommandSuffix: string;
    topOvrHeading: string;
    recentHeading: string;
    viewAllLink: string;
    quickLinksHeading: string;
    findPlayersLabel: string;
    findPlayersDescTemplate: string;
    comparePlayersLabel: string;
    comparePlayersDesc: string;
    buildSquadLabel: string;
    buildSquadDesc: string;
    exploreManagersLabel: string;
    exploreManagersDescTemplate: string;
    inDevelopmentHeading: string;
    inDevelopmentHint: string;
    featureTierList: string;
    featurePackDiagnosis: string;
    featureAiCoach: string;
    featureCommunity: string;
    designDocNote: string;
  };
  managersPage: {
    metaTemplate: string;
    descriptionTemplate: string;
    dataUnavailableTitle: string;
    dataUnavailableDescription: string;
    failedTitle: string;
    failedDescription: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFiltersLink: string;
    showingCountTemplate: string;
    prevPageLink: string;
    nextPageLink: string;
    pageOfTemplate: string;
    paginationAriaLabel: string;
  };
  nav: {
    groupMain: string;
    groupMyData: string;
    groupAnalysis: string;
    groupCommunity: string;
    home: string;
    players: string;
    managers: string;
    compare: string;
    squads: string;
    favorites: string;
    myTeam: string;
    myBuilds: string;
    buildInventory: string;
    bestXi: string;
    tierLists: string;
    packs: string;
    community: string;
    comingSoon: string;
    ariaSidebar: string;
    ariaCollapse: string;
    ariaExpand: string;
    collapseLabel: string;
    ariaMobileMenuOpen: string;
    ariaMobileMenuClose: string;
    ariaMobileMenu: string;
    ariaHome: string;
    brand: string;
  };
  header: {
    searchPlaceholder: string;
    searchAriaLabel: string;
    ariaHomeLink: string;
  };
  language: {
    japanese: string;
    english: string;
    ariaLabel: string;
  };
  diagnosis: {
    heading: string;
    unavailableTitle: string;
    unavailableMessage: string;
    mainDisclaimer: string;
    overallScore: string;
    tierBadgePrefix: string;
    notRated: string;
    ratedItems: string;
    placementCoverage: string;
    savedBuildMissingStat: string;
    savedBuildMissingUnitSuffix: string;
    coverageMetricsNote: string;
    commentModeNormal: string;
    commentModeHarsh: string;
    commentModeDisplayingSuffix: string;
    commentModeHarshBadge: string;
    improvementPrioritiesHeading: string;
    keepStrengthPrefix: string;
    commentSectionHeading: string;
    categoriesHeadingSuffix: string;
    detailsToggle: string;
    evidenceToggle: string;
    strengthsHeading: string;
    strengthsEmpty: string;
    weaknessesHeading: string;
    weaknessesEmpty: string;
    suggestionsHeading: string;
    criticalWarningsHeading: string;
    findingBadgeReferenceError: string;
    findingBadgeCompatibility: string;
    findingBadgeConfig: string;
    pngSaveButton: string;
    pngSaveButtonAriaLabel: string;
    pngSaveGenerating: string;
    pngSaveSuccess: string;
    pngSaveError: string;
    dataQualityStarters: string;
    dataQualityBench: string;
    dataQualityMissingBuild: string;
    dataQualityBrokenRef: string;
    dataQualityUnresolvedCard: string;
    dataQualityManagerUnresolved: string;
    dataQualityYes: string;
    dataQualityNo: string;
    unratedCategoriesPrefix: string;
    footerNote: string;
  };
  category: {
    attack: string;
    defense: string;
    aerial: string;
    speed: string;
    passBuildUp: string;
    dribblePossession: string;
    pressResistance: string;
    counterAttack: string;
    squadCompleteness: string;
  };
  managerPicker: {
    sortName: string;
    sortReleasedDesc: string;
    sortReleasedAsc: string;
    sortPossessionDesc: string;
    sortQuickCounterDesc: string;
    sortLongBallCounterDesc: string;
    sortOutWideDesc: string;
    sortLongBallDesc: string;
    sortOverloadDesc: string;
    defaultTitle: string;
    currentPrefix: string;
    currentIdPrefix: string;
    currentNone: string;
    setNoManager: string;
    searchLabel: string;
    searchPlaceholder: string;
    tacticFilterAria: string;
    tacticFilterAll: string;
    boosterFilterAria: string;
    boosterFilterAll: string;
    boosterFilterHas: string;
    boosterFilterNone: string;
    linkUpFilterAria: string;
    linkUpFilterAll: string;
    linkUpFilterHas: string;
    linkUpFilterNone: string;
    yearFilterAria: string;
    yearFilterAll: string;
    yearSuffix: string;
    sortAria: string;
    loadError: string;
    detailError: string;
    chooseError: string;
    noResultsTitle: string;
    noResultsDescription: string;
    countSuffix: string;
    selectedBadge: string;
    releasedPrefix: string;
    unknownReleased: string;
    noBoosterBadge: string;
    viewDetail: string;
    chooseThis: string;
    backToList: string;
    idPrefix: string;
    bestTacticPrefix: string;
    proficienciesHeading: string;
    boostersHeading: string;
    noBoosterMessage: string;
    boosterApplicationNote: string;
    linkUpHeading: string;
    centerPiecePrefix: string;
    keyManPrefix: string;
    linkUpNote: string;
    chooseThisSelected: string;
  };
  managerCard: {
    bestTacticLabel: string;
  };
  managerControls: {
    sortNameLabel: string;
    sortReleasedDesc: string;
    sortReleasedAsc: string;
    sortPossessionDesc: string;
    sortQuickCounterDesc: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    sortAriaLabel: string;
    boosterFilterAriaLabel: string;
    boosterFilterAllOption: string;
    boosterFilterHasOption: string;
    boosterFilterNoneOption: string;
    linkUpFilterAriaLabel: string;
    linkUpFilterAllOption: string;
    linkUpFilterHasOption: string;
    linkUpFilterNoneOption: string;
  };
  manager: {
    squadWideHeading: string;
    confirmedBoostersAppliedPrefix: string;
    confirmedBoostersAppliedSuffix: string;
    selectManagerTitle: string;
    none: string;
    noneDescription: string;
    selectFromList: string;
    change: string;
    clear: string;
    confirmedBoosterActive: string;
    unconfirmedBoosterNotice: string;
    linkUpPlayAvailable: string;
    applicationOrderUnconfirmed: string;
    viewManagerDetail: string;
    bestAt: string;
  };
  tactical: {
    sectionHeading: string;
    scopeDescription: string;
    placementCountLabel: string;
    placementCountUnit: string;
    severityHigh: string;
    severityMedium: string;
    severityLow: string;
    severityInfo: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    confidenceInsufficient: string;
    coverageInsufficient: string;
    coverageLimited: string;
    coveragePartial: string;
    coverageFull: string;
    potentialRiskPrefix: string;
    limitationsPrefix: string;
  };
  compareCategory: {
    attack: string;
    dribble: string;
    pass: string;
    defense: string;
    physical: string;
    speed: string;
    gk: string;
  };
  teamSummary: {
    heading: string;
    calcNote: string;
    boosterModeNote: string;
    startingBenchLabel: string;
    avgBaseOvrLabel: string;
    avgDisplayedOvrLabel: string;
    sharedSkillCountLabel: string;
    managerBoostedLabel: string;
    unresolvedCompatibilityLabel: string;
    possibleMismatchLabel: string;
    warningsLabel: string;
    peopleSuffix: string;
    countSuffix: string;
    positionBreakdownHeading: string;
    categoryAveragesHeading: string;
    sharedSkillsHeading: string;
    conditionalToggleLabel: string;
    conditionalNote: string;
    conditionalAvgDisplayedOvrLabel: string;
    conditionalCategoryLabelSuffix: string;
    conditionalValueTemplate: string;
  };
  buildUsage: {
    heading: string;
    viewDetail: string;
    setCountLabel: string;
    unsetCountLabel: string;
    missingCountLabel: string;
    peopleSuffix: string;
    footerTemplate: string;
    modalTitle: string;
    modalIntro: string;
    statTotal: string;
    statStarter: string;
    statBench: string;
    statSet: string;
    statUnset: string;
    statMissing: string;
    statCurrentRules: string;
    statLegacyRules: string;
    statUnknownRules: string;
    statPom: string;
    statExperimental: string;
    filterAll: string;
    filterSet: string;
    filterUnset: string;
    filterMissing: string;
    filterStarter: string;
    filterBench: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    emptyList: string;
    areaStarter: string;
    areaBench: string;
    buildUnset: string;
    buildMissingTemplate: string;
    buildSetPrefix: string;
    pomSuffix: string;
    experimentalSuffix: string;
    chooseBuildButton: string;
    manageInMyBuilds: string;
    closeButton: string;
    ruleCurrentLabel: string;
    ruleLegacyLabel: string;
    ruleUnknownLabel: string;
  };
  linkUp: {
    notice: string;
    noManagerNote: string;
    noDataNote: string;
    statusMet: string;
    statusPartial: string;
    statusUnmet: string;
    statusIndeterminate: string;
    noStyleSpecified: string;
    noConditionData: string;
    matchingStartersLabel: string;
    noneLabel: string;
    selectAriaTemplate: string;
    noManualSelection: string;
    selectedPrefix: string;
    satisfiesYes: string;
    satisfiesNo: string;
  };
  squadBuildPanel: {
    modalTitle: string;
    intro: string;
    targetHeading: string;
    targetSquadLabel: string;
    targetSlotLabel: string;
    cardDetailAriaTemplate: string;
    cardImageAltTemplate: string;
    cardImageAltGeneric: string;
    cardTypeUnknown: string;
    registeredPositionUnknown: string;
    currentBuildLabel: string;
    noneLabel: string;
    missingBuildTemplate: string;
    buildIdSuffixTemplate: string;
    clearSelectionButton: string;
    savedBuildCountTemplate: string;
    storageUnavailable: string;
    staleNotice: string;
    reloadButton: string;
    confirmDialogAria: string;
    confirmClearTextTemplate: string;
    clearChangedItemsLabel: string;
    clearUnchangedItemsLabel: string;
    confirmSetIntro: string;
    currentPrefixLabel: string;
    deletedTemplate: string;
    afterChangeLabel: string;
    ruleVersionTemplate: string;
    allocationLabel: string;
    noAllocation: string;
    pomLabel: string;
    pomUnspecified: string;
    setChangedItemsLabel: string;
    setUnchangedItemsLabel: string;
    setFooterNote: string;
    confirmSetButton: string;
    confirmClearButton: string;
    cancelButton: string;
    emptyBuildsHeading: string;
    emptyBuildsBody: string;
    playerDetailLink: string;
    progressionTabLink: string;
    myBuildsLink: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    noSearchResults: string;
    manageInMyBuilds: string;
    createBuildInProgression: string;
    closeButton: string;
    footerNote: string;
    alreadyUsingNotice: string;
    setSuccessTemplate: string;
    alreadyUnsetNotice: string;
    clearSuccessTemplate: string;
    errorStorage: string;
    errorCardId: string;
    errorSlotMissing: string;
    errorCardMismatch: string;
    errorBuildId: string;
    errorBuildMissing: string;
    inUseBadge: string;
    allocationRowLabel: string;
    noAllocationBase: string;
    allAllocationSummary: string;
    pointsUsedNoTotalTemplate: string;
    pointsUsedTotalTemplate: string;
    remainingUnknown: string;
    remainingTemplate: string;
    overAllocated: string;
    pomRowLabel: string;
    experimentalLabel: string;
    yes: string;
    no: string;
    estimatedOvrLabel: string;
    calcModeConfirmed: string;
    calcModeUnsupported: string;
    calcModeProvisional: string;
    totalOvrPlaceholder: string;
    createdUpdatedTemplate: string;
    useThisBuild: string;
    cardFallbackNameTemplate: string;
  };
  squadEditor: {
    assignErrorInvalidCard: string;
    assignErrorInvalidSlot: string;
    assignErrorSlotNotFound: string;
    assignErrorDuplicate: string;
    assignErrorSlotOccupied: string;
    assignErrorBenchFullTemplate: string;
    moveErrorInvalidSquad: string;
    moveErrorInvalidSource: string;
    moveErrorInvalidTarget: string;
    moveErrorSourceEmpty: string;
    moveErrorTargetNotFound: string;
    managerFetchFailed: string;
    storageUnavailableShort: string;
    slotNotFoundReopen: string;
    slotCardChangedReopen: string;
    buildNotFoundDeleted: string;
    reloadedFromStorage: string;
    undoLabelMovedSnap: string;
    undoLabelMoved: string;
    snapTypeHorizontal: string;
    snapTypeCenter: string;
    snapTypeSymmetry: string;
    placementRoleToastPrefix: string;
    placementRoleManualSuffix: string;
    roleManualOverrideTemplate: string;
    roleAutoRestored: string;
    undoLabelResetToFormation: string;
    freePositionReset: string;
    mirrorApplied: string;
    undoDoneTemplate: string;
    movedToBenchTemplate: string;
    droppedBenchFullTemplate: string;
    pendingPlacedNotice: string;
    templateSavedNotice: string;
    noStorageTitle: string;
    noStorageDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
    backToSquadList: string;
    squadNameAriaLabel: string;
    savedButtonLabel: string;
    saveButtonLabel: string;
    saveStateSaving: string;
    saveStateSaved: string;
    saveStateError: string;
    saveStateIdle: string;
    retrySaveButton: string;
    duplicateButton: string;
    templateNamePromptLabel: string;
    templateNamePromptSuffix: string;
    saveAsTemplateButton: string;
    templateListLink: string;
    compareWithAnotherLink: string;
    compareWithAnotherTitle: string;
    renamePromptLabel: string;
    renameButton: string;
    resetButton: string;
    rulesOutdatedNotice: string;
    loadingPlacedCardsTemplate: string;
    failedPlacedCardsTemplate: string;
    retryWithIdTemplate: string;
    confirmResetTemplate: string;
    confirmResetButton: string;
    cancelActionButton: string;
    mobileTabPitch: string;
    mobileTabBench: string;
    mobileTabManager: string;
    mobileTabSummary: string;
    mobileTabLinkUp: string;
    moveBannerTemplate: string;
    moveBannerFallbackName: string;
    moveBannerCancel: string;
    undoBannerTemplate: string;
    undoButton: string;
    pendingAlreadyPlacedTemplate: string;
    pendingOkButton: string;
    pendingChooseTargetTemplate: string;
    pendingBuildNameTemplate: string;
    pendingAddToBenchButton: string;
    pendingCancelButton: string;
    pendingBuildNotFoundText: string;
    pendingGoToMyTeamLink: string;
    placementAidLabel: string;
    snapToggleTemplate: string;
    guidesToggleTemplate: string;
    gridToggleTemplate: string;
    mirrorPlacementButton: string;
    resetToFormationButton: string;
    pitchCaptionMain: string;
    pitchLegendMatch: string;
    pitchLegendUnresolved: string;
    pitchLegendMismatch: string;
    confirmMirrorText: string;
    confirmMirrorButton: string;
    confirmResetPosTemplate: string;
    confirmResetPosButton: string;
    posAdjustBanner: string;
    posAdjustEndButton: string;
    addPlayerToSlotTitleTemplate: string;
    addPlayerToBenchTitle: string;
    addToSlotLabelTemplate: string;
    addToBenchLabel: string;
    emptySlotHeadingSuffix: string;
    slotCardFetchFailedTemplate: string;
    retryButton: string;
    removeFromSlotButton: string;
    slotCardLoadingTemplate: string;
    selectSlotHint: string;
    compareHeading: string;
    compareSelectedCountTemplate: string;
    compareSelectedHint: string;
    compareGoLink: string;
    compareClearButton: string;
    roleSettingsHeading: string;
    captainLabel: string;
    roleUnsetOption: string;
    freeKickLabel: string;
    cornerLabel: string;
    penaltyLabel: string;
    roleAutoClearNote: string;
    warningsHeadingTemplate: string;
    skeletonLoading: string;
    starterFallbackLabel: string;
    starterSlotFallbackLabel: string;
    benchAreaFallbackLabel: string;
  };
  squadList: {
    pageTitle: string;
    pageDescriptionTemplate: string;
    goToCompareLink: string;
    pendingCardBannerBoldTemplate: string;
    pendingCardBannerNameLoading: string;
    pendingCardBannerSuffix: string;
    pendingCardDetailLink: string;
    noStorageTitle: string;
    noStorageDescription: string;
    templateNamePrompt: string;
    templateNamePromptSuffix: string;
    defaultNewSquadName: string;
    createFormHeading: string;
    squadNameLabel: string;
    squadNameAriaLabel: string;
    squadNamePlaceholder: string;
    formationLabel: string;
    createAndEditButton: string;
    heroHeading: string;
    heroDescription: string;
    createFirstSquadButton: string;
    createNewSquadButton: string;
    goToCompareButton: string;
    savedSquadsHeadingTemplate: string;
    compareSquadsLink: string;
    templateListLink: string;
    searchByNamePlaceholder: string;
    searchByNameAriaLabel: string;
    searchByPlayerPlaceholder: string;
    searchByPlayerAriaLabel: string;
    formationFilterAriaLabel: string;
    formationFilterAll: string;
    customFilterAriaLabel: string;
    customFilterAll: string;
    customFilterYes: string;
    customFilterNo: string;
    sortAriaLabel: string;
    sortUpdatedDesc: string;
    sortCreatedDesc: string;
    sortName: string;
    sortFormation: string;
    loading: string;
    emptyTitle: string;
    emptyDescription: string;
    noResultsMatchFilter: string;
    customPositioningBadge: string;
    startingCountTemplate: string;
    benchCountTemplate: string;
    hasManagerLabel: string;
    noManagerLabel: string;
    updatedAtTemplate: string;
    outdatedRulesBadge: string;
    addThisCardLink: string;
    openLink: string;
    compareLink: string;
    compareLinkTitle: string;
    duplicateButton: string;
    saveAsTemplateButton: string;
    renameButton: string;
    deleteButton: string;
    renamePrompt: string;
    deleteConfirmTemplate: string;
    deleteConfirmButton: string;
    deleteCancelButton: string;
    deleteFailedFallback: string;
  };
  myTeamBuildPanel: {
    modalTitle: string;
    intro: string;
    cardDetailAriaTemplate: string;
    cardImageAltTemplate: string;
    cardImageAltGeneric: string;
    cardTypeUnknown: string;
    registeredPositionUnknown: string;
    currentSettingsHeading: string;
    selectedBuildLabel: string;
    favoriteBuildLabel: string;
    noneLabel: string;
    selectedMissingTemplate: string;
    favoriteMissingTemplate: string;
    buildIdSuffixTemplate: string;
    clearSelectedButton: string;
    clearFavoriteButton: string;
    ownershipUsageTemplate: string;
    unknownValuePlaceholder: string;
    savedBuildCountTemplate: string;
    storageUnavailable: string;
    staleNotice: string;
    reloadButton: string;
    confirmClearAria: string;
    confirmClearTextTemplate: string;
    confirmClearUnchangedTemplate: string;
    confirmClearButton: string;
    cancelButton: string;
    emptyBuildsHeading: string;
    emptyBuildsBody: string;
    playerDetailLink: string;
    progressionTabLink: string;
    compareLink: string;
    myBuildsLink: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    noSearchResults: string;
    manageInMyBuilds: string;
    createBuildInProgression: string;
    closeButton: string;
    footerNote: string;
    alreadySelectedNotice: string;
    alreadyFavoriteNotice: string;
    setFailedTemplate: string;
    unknownError: string;
    setSelectedSuccessTemplate: string;
    setFavoriteSuccessTemplate: string;
    clearFailedTemplate: string;
    clearSelectedSuccess: string;
    clearFavoriteSuccess: string;
    deletedBuildFallback: string;
    selectedBadge: string;
    favoriteBadge: string;
    selectedBuildNoun: string;
    favoriteBuildNoun: string;
    allocationRowLabel: string;
    noAllocationBase: string;
    allAllocationSummary: string;
    pointsUsedNoTotalTemplate: string;
    pointsUsedTotalTemplate: string;
    remainingUnknown: string;
    remainingTemplate: string;
    overAllocated: string;
    pomRowLabel: string;
    pomUnspecified: string;
    experimentalLabel: string;
    yes: string;
    no: string;
    estimatedOvrLabel: string;
    calcModeConfirmed: string;
    calcModeUnsupported: string;
    calcModeProvisional: string;
    totalOvrPlaceholder: string;
    createdUpdatedTemplate: string;
    setSelectedButton: string;
    setFavoriteButton: string;
  };
  radarAxis: {
    attack: string;
    pass: string;
    dribble: string;
    defense: string;
    physical: string;
    speed: string;
    gk: string;
  };
  radarMode: {
    base: string;
    progressed: string;
    standard: string;
    conditional: string;
    experimental: string;
  };
  myBuildCard: {
    selectPlayerDetailAriaTemplate: string;
    cardImageAltResolving: string;
    maxBaseOvrTemplate: string;
    fetchFailedNote: string;
    allocationHeading: string;
    viewAllAllocationsSummary: string;
    legacyBuildWarningTemplate: string;
    playerBoosterEstimateTemplate: string;
    estimatedOvrTemplate: string;
    usageHeading: string;
    squadUsingSuffixTemplate: string;
    squadUsingLinkTemplate: string;
    noUsageLabel: string;
    playerDetailLink: string;
    openProgressionLink: string;
    addToCompareButton: string;
    useInSquadLink: string;
    myTeamIntegrationHeading: string;
    notInMyTeamLabel: string;
    registerToMyTeamButton: string;
    openMyTeamLink: string;
    registerHintNote: string;
    selectedBuildLabel: string;
    selectedInMyTeamBadge: string;
    clearSelectionButton: string;
    useInMyTeamButton: string;
    favoriteBuildLabel: string;
    favoriteInMyTeamBadge: string;
    clearFavoriteButton: string;
    setFavoriteButton: string;
    favoriteHintNote: string;
    renameButton: string;
    duplicateButton: string;
    deleteButton: string;
  };
  buildExportModal: {
    launcherHeading: string;
    launcherDescription: string;
    launcherButton: string;
    noBuildsNote: string;
    unavailableNote: string;
    safetyLine1: string;
    safetyLine2: string;
    safetyLine3: string;
    safetyLine4: string;
    staleNoticeText: string;
    reloadButton: string;
    droppedNoticeTemplate: string;
    errorSelectBuilds: string;
    errorSelectionChanged: string;
    conflictListChangedTemplate: string;
    conflictSelectionNotFound: string;
    conflictSelectionChangedTemplate: string;
    saveFailedNote: string;
    jsonFileTypeDescription: string;
    titleChoose: string;
    titleConfirm: string;
    titleDone: string;
    doneMessagePickerTemplate: string;
    doneMessageDownloadTemplate: string;
    downloadFallbackNote: string;
    utcNotePrefix: string;
    utcNoteSuffix: string;
    backButton: string;
    closeButton: string;
    cancelButton: string;
    nextButton: string;
    choosePickerLocationButton: string;
    downloadJsonButton: string;
    exportMethodLegend: string;
    exportAllOptionTemplate: string;
    exportSelectionOption: string;
    exportSelectionHint: string;
    searchTargetLabel: string;
    searchAriaLabel: string;
    selectAllVisibleTemplate: string;
    clearVisibleSelectionButton: string;
    selectedCountTemplate: string;
    noSavedBuildsLabel: string;
    noMatchingBuildsLabel: string;
    includeInExportAriaTemplate: string;
    usedBadge: string;
    unusedBadge: string;
    updatedTemplate: string;
    exportContentHeading: string;
    allBuildsLabel: string;
    selectedBuildsLabel: string;
    targetPrefixTemplate: string;
    targetCountSuffix: string;
    formatLabelPrefix: string;
    formatVersionLabelPrefix: string;
    formatVersionNote: string;
    singleJsonFileNote: string;
    exportedAtNoteSuffix: string;
    itemCountNoteMiddle: string;
    itemCountNoteSuffix: string;
    aboutSaveLocationHeading: string;
    pickerInstructionPrefix: string;
    pickerInstructionBold: string;
    pickerNote1Prefix: string;
    pickerNote1Bold: string;
    pickerNote1Suffix: string;
    pickerNote2: string;
    pickerNote3: string;
    pickerNote4Prefix: string;
    pickerNote4Bold: string;
    pickerNote4Suffix: string;
    pickerNote5: string;
    noPickerNote: string;
    pickerNextNoteTemplate: string;
    downloadNextNoteTemplate: string;
    cancelledNoticeTemplate: string;
    exportTargetLineTemplate: string;
    exportFailureEmpty: string;
    exportFailureInvalidTemplate: string;
  };
  buildImportModal: {
    safetyLine1: string;
    safetyLine2: string;
    safetyLine3: string;
    safetyLine4: string;
    safetyLine5: string;
    safetyLine6: string;
    safetyLine7: string;
    launcherHeading: string;
    launcherDescriptionPrefix: string;
    addBoldLabel: string;
    launcherDescriptionSuffix: string;
    launcherButton: string;
    unavailableNote: string;
    validateErrorTemplate: string;
    duplicateErrorTemplate: string;
    parseErrorEmpty: string;
    parseErrorTooLarge: string;
    parseErrorNotJson: string;
    parseErrorNotObject: string;
    parseErrorUnsafeKeys: string;
    parseErrorFormatMismatch: string;
    parseErrorUnsupportedVersion: string;
    parseErrorExportedAt: string;
    parseErrorItemCount: string;
    parseErrorItemCountMismatch: string;
    parseErrorGeneric: string;
    tooLargeTemplate: string;
    noFileApiError: string;
    readFailedError: string;
    importConflictTemplate: string;
    saveConflictNote: string;
    quotaError: string;
    storageError: string;
    genericSaveError: string;
    reverifyFailedNote: string;
    titleSelect: string;
    titleError: string;
    titlePreview: string;
    titleConfirm: string;
    titleSaving: string;
    titleDone: string;
    titleSaveFail: string;
    staleBlockedText: string;
    reloadExistingButton: string;
    savingText: string;
    doneMessageTemplate: string;
    doneNewIdsTemplate: string;
    doneManageNote: string;
    saveFailFallback: string;
    cancelButton: string;
    pickAnotherFileButton: string;
    importButtonTemplate: string;
    closeButton: string;
    supportedFilesHeading: string;
    supportedFile1Prefix: string;
    supportedFile1Middle: string;
    supportedFile1Suffix: string;
    supportedFile2: string;
    supportedFile3Template: string;
    supportedFile4: string;
    selectFileLabel: string;
    selectFileHint: string;
    validatingText: string;
    selectedFileTemplate: string;
    selectedFileSizeTemplate: string;
    validateInfoTemplate: string;
    duplicateIdsTemplate: string;
    fileHeading: string;
    fileNameLabel: string;
    fileSizeLabel: string;
    validationHeading: string;
    validCountLabel: string;
    plannedSaveCountLabel: string;
    collisionCountLabel: string;
    saveCountNoteTemplate: string;
    targetBuildsSummaryTemplate: string;
    newBuildIdBadge: string;
    pomBadge: string;
    experimentalBadge: string;
    worldIdOriginalTemplate: string;
    finalBuildIdTemplate: string;
    noChangeLabel: string;
    rulesVersionTemplate: string;
    allocationLabelTemplate: string;
    createdUpdatedNoteTemplate: string;
    unaffectedHeading: string;
    unaffected1: string;
    unaffected2: string;
    unaffected3: string;
    unaffected4: string;
    unaffected5: string;
    unaffectedFootnote: string;
    confirmTitleTemplate: string;
    confirmNote1: string;
    confirmCollisionTemplate: string;
    confirmNoCollision: string;
    confirmNote2: string;
    confirmNote3: string;
    confirmButton: string;
  };
  duplicateReviewTeaser: {
    bodyPrefix: string;
    duplicateCandidatesLabel: string;
    bodySuffix: string;
    openInventoryLink: string;
  };
  myBuildsView: {
    pageTitle: string;
    pageDescription: string;
    sortUpdatedDesc: string;
    sortUpdatedAsc: string;
    sortCreatedDesc: string;
    sortCreatedAsc: string;
    sortNameAsc: string;
    sortPlayerAsc: string;
    renameTargetMissing: string;
    renamedNoticeTemplate: string;
    duplicateFailedTemplate: string;
    duplicatedNoticeTemplate: string;
    deleteFailedTemplate: string;
    deletedNotice: string;
    alreadyRegisteredNotice: string;
    registerFailedTemplate: string;
    favoriteAlsoSetTemplate: string;
    favoriteSetFailedNote: string;
    selectedAlsoSetTemplate: string;
    registeredNoticeTemplate: string;
    alreadySelectedNotice: string;
    assignFailedTemplate: string;
    assignedNoticeTemplate: string;
    selectionChangedError: string;
    clearSelectionFailedTemplate: string;
    clearedSelectionNotice: string;
    alreadyFavoriteNotice: string;
    setFavoriteFailedTemplate: string;
    setFavoriteNoticeTemplate: string;
    clearFavoriteFailedTemplate: string;
    clearedFavoriteNoticeTemplate: string;
    unknownError: string;
    emptyTitle: string;
    emptyDescription: string;
    findPlayersLink: string;
    openComparelink: string;
    openMyTeamLink: string;
    openSquadsLink: string;
    storageUnavailableNotice: string;
    staleBuildsNotice: string;
    staleMyTeamNotice: string;
    reloadButton: string;
    statTotalLabel: string;
    statVisibleLabel: string;
    statUsedLabel: string;
    statUnusedLabel: string;
    usedExplanationNote: string;
    filterSectionHeading: string;
    filterActiveBadge: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    cardTypeLabel: string;
    cardTypeAriaLabel: string;
    filterAllOption: string;
    positionLabel: string;
    positionAriaLabel: string;
    rulesLabel: string;
    rulesAriaLabel: string;
    pomLabel: string;
    pomAriaLabel: string;
    pomWithOption: string;
    experimentalLabel: string;
    experimentalAriaLabel: string;
    experimentalWithOption: string;
    usageLabel: string;
    usageAriaLabel: string;
    usageUsedOption: string;
    usageUnusedOption: string;
    sortLabel: string;
    sortAriaLabel: string;
    clearFiltersButton: string;
    noResultsTitle: string;
    deleteConfirmTitle: string;
    deleteConfirmButton: string;
    clearSelectionConfirmTitle: string;
    clearSelectionConfirmButton: string;
    clearSelectionBodyTemplate: string;
    idLineTemplate: string;
    clearSelectionUnchangedNote: string;
    clearFavoriteConfirmTitle: string;
    clearFavoriteConfirmButton: string;
    clearFavoriteBodyTemplate: string;
    clearFavoriteChangedItem: string;
    clearFavoriteUnchangedItemTemplate: string;
    registerModalTitle: string;
    cardImageAltTemplate: string;
    cardImageAltGeneric: string;
    cardTypeUnknown: string;
    registeredPositionUnknown: string;
    alreadyInMyTeamNotice: string;
    buildToUseLabel: string;
    buildIdSuffixTemplate: string;
    allocationLabel: string;
    noAllocationBase: string;
    usedPointsLabel: string;
    totalUnknownSuffix: string;
    totalPointsSuffixTemplate: string;
    pomRowLabel: string;
    pomUnspecified: string;
    experimentalRowLabel: string;
    yes: string;
    no: string;
    estimatedOvrLabel: string;
    calcModeConfirmed: string;
    calcModeUnsupported: string;
    calcModeProvisional: string;
    totalOvrPlaceholder: string;
    ownershipLabel: string;
    ownershipHint: string;
    usageStatusLabel: string;
    usageStatusHint: string;
    associationLegend: string;
    setSelectedOptionPrefix: string;
    setSelectedOptionSuffix: string;
    setSelectedHint: string;
    setFavoriteOptionPrefix: string;
    setFavoriteOptionSuffix: string;
    setFavoriteHint: string;
    previewHeading: string;
    previewOwnershipTemplate: string;
    previewUsageTemplate: string;
    previewSelectedTemplate: string;
    previewFavoriteTemplate: string;
    previewTagsNone: string;
    previewNotesNone: string;
    previewSquadNoChange: string;
    previewFavoriteFlagNoChange: string;
    previewNoneValue: string;
    twoStageNote: string;
    unchangedListItem1: string;
    unchangedListItem2: string;
    confirmStatement: string;
    cancelButton: string;
    registerButton: string;
    changeFavoriteModalTitle: string;
    notInMyTeamNotice: string;
    settingBuildLabel: string;
    currentFavoriteLabel: string;
    noneLabel: string;
    currentFavoriteMissingTemplate: string;
    currentSelectedUnchangedLabel: string;
    missingBuildFallback: string;
    alreadyFavoriteNoChangeNote: string;
    confirmFavoriteChangeTemplate: string;
    favoriteChangedItem: string;
    favoriteUnchangedItemTemplate: string;
    favoriteNoAutoApplyNote: string;
    makeFavoriteButton: string;
    changeSelectedModalTitle: string;
    currentSelectedLabel: string;
    currentSelectedMissingTemplate: string;
    alreadySelectedNoChangeNote: string;
    confirmSelectedChangeTemplate: string;
    selectedChangedItem: string;
    selectedUnchangedItemTemplate: string;
    selectedNoAutoApplyNote: string;
    makeSelectedButton: string;
    renameModalTitle: string;
    renameDescription: string;
    newNameLabel: string;
    newNameAriaLabel: string;
    changeButton: string;
    deleteBodyTemplate: string;
    referencedFromLabel: string;
    myTeamSelectedItem: string;
    myTeamFavoriteItem: string;
    squadReferenceTemplate: string;
    deleteSafeNote: string;
    noReferenceNote: string;
    deleteIrreversibleNote: string;
  };
  compareAddButton: {
    fullMessageTemplate: string;
    removeFromCompareAria: string;
    addToCompareAria: string;
    inCompareLabel: string;
    compareFullLabel: string;
    addToCompareLabel: string;
    inCompareCheckedLabel: string;
    viewCompareTemplate: string;
  };
  duplicateReviewSection: {
    sortUpdatedDesc: string;
    sortCreatedDesc: string;
    sortSizeDesc: string;
    sortRefsDesc: string;
    sortUnusedFirst: string;
    sortUsedFirst: string;
    sortPlayerAsc: string;
    sortNameAsc: string;
    sortIdStable: string;
    headingTemplate: string;
    intro1: string;
    intro2: string;
    intro3: string;
    staleNoticeTemplate: string;
    staleBuildLabel: string;
    staleMyTeamLabel: string;
    staleSquadLabel: string;
    totalBuildsLabel: string;
    exactGroupCountLabel: string;
    exactBuildCountLabel: string;
    similarGroupCountLabel: string;
    similarBuildCountLabel: string;
    noCandidateLabel: string;
    unresolvedLabel: string;
    usedCandidateLabel: string;
    unusedCandidateLabel: string;
    myTeamRefCandidateLabel: string;
    squadRefCandidateLabel: string;
    unitBuildSuffix: string;
    unitGroupSuffix: string;
    footnote: string;
    statusLabel: string;
    statusWarning: string;
    statusNormal: string;
    unresolvedSuffix: string;
    unresolvedSummaryTemplate: string;
    worldIdTemplate: string;
    worldIdUnknown: string;
    buildIdTemplate: string;
    buildIdUnknown: string;
    unresolvedFootnote: string;
    similarUnsupportedNote: string;
    noBuildsLabel: string;
    noExactMatchLabel: string;
    noMatchingCandidatesLabel: string;
    searchFilterSortHeading: string;
    filterActiveLabel: string;
    searchLabel: string;
    searchAriaLabel: string;
    kindFilterLabel: string;
    allOption: string;
    exactOption: string;
    similarOption: string;
    usageFilterLabel: string;
    usedOption: string;
    unusedOption: string;
    rulesFilterLabel: string;
    currentRulesOption: string;
    legacyRulesOption: string;
    cardTypeFilterLabel: string;
    registeredPositionFilterLabel: string;
    myTeamRefCheckLabel: string;
    squadRefCheckLabel: string;
    multiUseCheckLabel: string;
    pomCheckLabel: string;
    experimentalCheckLabel: string;
    sortLabel: string;
    clearSearchButton: string;
    exactBadge: string;
    similarBadge: string;
    buildCountSuffix: string;
    anyUsedBadge: string;
    allUnusedBadge: string;
    matchingFieldsHeading: string;
    differingFieldsHeading: string;
    similarReasonTemplate: string;
    usedRefTemplate: string;
    unusedBadge: string;
    multiUseBadge: string;
    pomBadge: string;
    experimentalBadge: string;
    selectedBoosterLabel: string;
    pomFieldLabel: string;
    estimatedOvrLabel: string;
    myTeamSelectedInline: string;
    myTeamFavoriteInline: string;
    noReferenceLabel: string;
    openMyTeamLink: string;
    openSquadTemplate: string;
  };
  buildInventoryView: {
    pageTitle: string;
    pageDescription: string;
    sortUpdatedDesc: string;
    sortUpdatedAsc: string;
    sortCreatedDesc: string;
    sortPlayerAsc: string;
    sortNameAsc: string;
    sortRefsDesc: string;
    sortRefsAsc: string;
    sortProblemFirst: string;
    sortUnusedFirst: string;
    issueMissing: string;
    issueMismatch: string;
    issueInvalidBuildId: string;
    issueUnknown: string;
    emptyTitle: string;
    emptyDescription: string;
    openCompareLink: string;
    openMyBuildsLink: string;
    openMyTeamLink: string;
    openSquadsLink: string;
    storageWarningTemplate: string;
    missingBuildsLabel: string;
    missingMyTeamLabel: string;
    missingSquadLabel: string;
    cardsErrorSuffix: string;
    staleNoticeTemplate: string;
    staleBuildLabel: string;
    staleMyTeamLabel: string;
    staleSquadLabel: string;
    summaryHeading: string;
    statusPrefix: string;
    statusWarning: string;
    statusNormal: string;
    totalBuildsLabel: string;
    usedLabel: string;
    unusedLabel: string;
    multiUseLabel: string;
    myTeamSelectedLabel: string;
    myTeamFavoriteLabel: string;
    squadUsedLabel: string;
    currentRulesLabel: string;
    legacyRulesLabel: string;
    unknownRulesLabel: string;
    pomBuildsLabel: string;
    experimentalBuildsLabel: string;
    missingMyTeamRefsLabel: string;
    missingSquadRefsLabel: string;
    mismatchRefsLabel: string;
    invalidBuildIdRefsLabel: string;
    unknownRefsLabel: string;
    unitBuildSuffix: string;
    unitCountSuffix: string;
    unitSlotSuffix: string;
    summaryFootnote: string;
    legacyGuideHeadingTemplate: string;
    legacyGuideIntro: string;
    legacyGuideCaution: string;
    legacyGuideCautionNotes: string;
    legacyStepsHeading: string;
    legacyStep1: string;
    legacyStep2: string;
    legacyStep3: string;
    legacyStep4: string;
    legacyStep5: string;
    legacyStep6: string;
    legacyNote1: string;
    legacyNote2: string;
    legacyNote3: string;
    legacyUnitFootnote: string;
    showLegacyOnlyButton: string;
    clearFilterButton: string;
    manageInMyBuildsLink: string;
    perRowGuideNote: string;
    noLegacyTitle: string;
    noLegacyDescription: string;
    issuesSummaryTemplate: string;
    noIssuesLabel: string;
    allFilterLabel: string;
    searchIssuesPlaceholder: string;
    searchIssuesAriaLabel: string;
    noMatchingIssuesLabel: string;
    issuesFootnote: string;
    searchFilterSortHeading: string;
    filterActiveLabel: string;
    searchLabel: string;
    searchPlaceholderExample: string;
    searchAriaLabel: string;
    usageFilterLabel: string;
    allOption: string;
    usedOption: string;
    unusedOption: string;
    rulesFilterLabel: string;
    currentRulesOption: string;
    legacyRulesOption: string;
    unknownRulesOption: string;
    cardTypeFilterLabel: string;
    registeredPositionFilterLabel: string;
    myTeamSelectedCheckLabel: string;
    myTeamFavoriteCheckLabel: string;
    squadUsedCheckLabel: string;
    multiUseCheckLabel: string;
    pomCheckLabel: string;
    experimentalCheckLabel: string;
    problemRefCheckLabel: string;
    sortAriaLabel: string;
    clearSearchButton: string;
    showingCountPrefix: string;
    showingCountMiddle: string;
    showingCountSuffix: string;
    noResultsTitle: string;
    noResultsDescription: string;
    usageHeadingTemplate: string;
    myTeamSelectedCountTemplate: string;
    myTeamFavoriteCountTemplate: string;
    squadAreaSuffixTemplate: string;
    starterSlotsTemplate: string;
    benchSlotsTemplate: string;
    notUsedLabel: string;
    myTeamLinkLabel: string;
    usedRefTemplate: string;
    multiUseBadge: string;
    mismatchRefTemplate: string;
    starterAreaLabel: string;
    benchAreaLabel: string;
    squadSourceTemplate: string;
    myTeamSelectedSourceTemplate: string;
    myTeamFavoriteSourceTemplate: string;
    openSquadLink: string;
    experimentalSuffixTemplate: string;
    experimentalYesLabel: string;
    experimentalNoLabel: string;
  };
  buildAnalysis: {
    analyzeButtonLabel: string;
    analyzingStatusLabel: string;
    panelHeadingTemplate: string;
    closePanelAriaTemplate: string;
    normalModeLabel: string;
    harshModeLabel: string;
    modeToggleGroupAriaLabel: string;
    pointsHeading: string;
    trainingFocusHeading: string;
    strongestGrowthHeading: string;
    underinvestedHeading: string;
    strengthsHeading: string;
    concernsHeading: string;
    normalReviewHeading: string;
    harshReviewHeading: string;
    improvementHeading: string;
    comparisonHeading: string;
    limitationsHeading: string;
    confidenceLabel: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLimited: string;
    confidenceUnavailable: string;
    noStrengthsText: string;
    noConcernsText: string;
    noSuggestionsText: string;
    noComparisonText: string;
    noLimitationsText: string;
    priorityLabelTemplate: string;
    suggestionTargetTemplate: string;
    suggestionReasonLabel: string;
    suggestionRecheckLabel: string;
    suggestionPreserveLabel: string;
    suggestionPreserveNoneText: string;
    improvementSourceIntentLabel: string;
    generalSuggestionsToggleLabel: string;
    comparisonUsedPointsMoreTemplate: string;
    comparisonUsedPointsLessTemplate: string;
    comparisonUsedPointsSameText: string;
    comparisonRemainingPointsDiffUnknownText: string;
    comparisonRemainingPointsMoreTemplate: string;
    comparisonRemainingPointsLessTemplate: string;
    comparisonRemainingPointsSameText: string;
    comparisonOvrMoreTemplate: string;
    comparisonOvrLessTemplate: string;
    comparisonOvrSameText: string;
    comparisonOvrDiffUnknownText: string;
    comparisonFocusDifferentTemplate: string;
    comparisonFocusSameText: string;
    comparisonUsedStatusUsed: string;
    comparisonUsedStatusUnused: string;
    comparisonUpdatedAtTemplate: string;
    trainingFocusNoneText: string;
    trainingFocusSingleTemplate: string;
    trainingFocusDominantTemplate: string;
    trainingFocusDominantNoSecondaryTemplate: string;
    trainingFocusBalancedTemplate: string;
    strongestGrowthNoneText: string;
    underinvestedNoneText: string;
    completionLabel: string;
    completionUnallocated: string;
    completionInProgress: string;
    completionNearComplete: string;
    completionComplete: string;
    completionUnknown: string;
    findingNoAllocationNormal: string;
    findingNoAllocationHarsh: string;
    findingFocusedPrimaryCategoryNormal: string;
    findingFocusedPrimaryCategoryHarsh: string;
    findingBalancedAllocationNormal: string;
    findingBalancedAllocationHarsh: string;
    findingNearFullyAllocated: string;
    findingManyRemainingPointsNormal: string;
    findingManyRemainingPointsHarsh: string;
    findingUnderinvestedAreaPresentNormal: string;
    findingUnderinvestedAreaPresentHarsh: string;
    findingLegacyOrUnknownRulesNormal: string;
    findingLegacyOrUnknownRulesHarsh: string;
    findingReferenceAnomalyNormal: string;
    findingReferenceAnomalyHarsh: string;
    findingExperimentalTrialIncluded: string;
    findingPowerOfManyIncluded: string;
    findingUniqueVsSiblings: string;
    findingOverlapsWithSiblingNormal: string;
    findingOverlapsWithSiblingHarsh: string;
    findingOverlapsWithSiblingAbilityConfirmedHarsh: string;
    findingInsufficientData: string;
    findingOverAllocatedPoints: string;
    suggestionTitleReferenceAnomaly: string;
    suggestionTitleStartAllocation: string;
    suggestionTitleUseRemainingPoints: string;
    suggestionTitleConsiderUnderinvestedArea: string;
    suggestionTitleRecheckUnderCurrentRules: string;
    suggestionTitleDifferentiateFromSibling: string;
    suggestionReasonReferenceAnomaly: string;
    suggestionReasonNoAllocation: string;
    suggestionReasonManyRemainingPoints: string;
    suggestionReasonUnderinvestedArea: string;
    suggestionReasonLegacyRules: string;
    suggestionReasonOverlapsWithSibling: string;
    suggestionRecheckReferenceAnomaly: string;
    suggestionRecheckNoAllocation: string;
    suggestionRecheckManyRemainingPoints: string;
    suggestionRecheckUnderinvestedArea: string;
    suggestionRecheckLegacyRules: string;
    suggestionRecheckOverlapsWithSibling: string;
    findingAbilityGainReflectsFocus: string;
    findingAbilityGainHighlight: string;
    findingOverinvestmentCandidateNormal: string;
    findingOverinvestmentCandidateHarsh: string;
    findingUnderinvestedButHighFinal: string;
    findingUnderinvestedAndLowFinal: string;
    findingUnderinvestedContextUnknown: string;
    findingAbilityDataUnavailable: string;
    findingAbilityComparisonPracticallySame: string;
    findingAbilityComparisonDifferentFocus: string;
    suggestionTitleOverinvestmentCandidate: string;
    suggestionReasonOverinvestmentCandidate: string;
    suggestionRecheckOverinvestmentCandidate: string;
    abilityMainEffectsHeading: string;
    abilityLargestGainsLabel: string;
    abilityHighestFinalLabel: string;
    abilityNoGainsText: string;
    abilityNoDataText: string;
    abilityLoadingText: string;
    abilityBeforeLabel: string;
    abilityTrainedLabel: string;
    abilityFinalLabel: string;
    abilityGainValueTemplate: string;
    abilityDetailToggleLabel: string;
    abilityDetailRowTemplate: string;
    abilityComparisonDiffHeading: string;
    abilityComparisonNoDataText: string;
    abilityComparisonConditionLegacyText: string;
    abilityComparisonConditionUnallocatedText: string;
    abilityComparisonDiffRowTemplate: string;
    intentSectionHeading: string;
    intentUnsavedNote: string;
    intentPositionLabel: string;
    intentPositionNoneOption: string;
    intentPrimaryGoalLabel: string;
    intentGroupPrioritiesHeading: string;
    intentFieldPlayersHeading: string;
    intentGoalkeepingHeading: string;
    intentStatePriority: string;
    intentStateNormal: string;
    intentStateLow: string;
    buildIntentFreeTextLabel: string;
    buildIntentFreeTextDescription: string;
    buildIntentFreeTextPlaceholder: string;
    intentUserNoteCounterTemplate: string;
    buildIntentExampleToggleLabel: string;
    buildIntentExampleText: string;
    buildIntentAnalyzeButtonLabel: string;
    buildIntentAnalyzingLabel: string;
    buildIntentCancelLabel: string;
    buildIntentRetryLabel: string;
    buildIntentDiscardLabel: string;
    buildIntentConfirmButtonLabel: string;
    buildIntentInterpretationHeading: string;
    buildIntentStaleNotice: string;
    buildIntentNotConfiguredNotice: string;
    buildIntentFailedNotice: string;
    buildIntentConfirmedNotice: string;
    buildIntentManualDetailsToggleLabel: string;
    buildIntentAvoidOverinvestmentLabel: string;
    buildIntentIntentionallyIgnoreLabel: string;
    buildIntentComparisonTargetLabel: string;
    buildIntentComparisonTargetNoneOption: string;
    buildIntentStrengthsToPreserveLabel: string;
    buildIntentAmbiguitiesHeading: string;
    buildIntentAmbiguitiesNoneText: string;
    buildIntentConfidenceLabel: string;
    buildIntentConfidenceHigh: string;
    buildIntentConfidenceMedium: string;
    buildIntentConfidenceLow: string;
    buildIntentInterpPositionLabel: string;
    buildIntentInterpGoalLabel: string;
    buildIntentInterpPriorityLabel: string;
    buildIntentInterpSecondaryLabel: string;
    buildIntentInterpAvoidOverinvestmentLabel: string;
    buildIntentInterpIgnoredLabel: string;
    buildIntentInterpComparisonTargetLabel: string;
    buildIntentInterpComparisonFocusLabel: string;
    buildIntentInterpPreserveLabel: string;
    buildIntentInterpNoneValue: string;
    buildIntentReadHeading: string;
    buildIntentUnspecifiedCollapsedLabel: string;
    buildIntentClarificationHeading: string;
    clarificationNoneOptionLabel: string;
    clarificationNoneOptionDescription: string;
    buildIntentClarificationPendingNotice: string;
    clarificationCrossRoleQuestion: string;
    clarificationCrossRoleReason: string;
    clarificationCrossSupplyLabel: string;
    clarificationCrossSupplyDescription: string;
    clarificationCrossReceiveLabel: string;
    clarificationCrossReceiveDescription: string;
    clarificationCrossWideAttackLabel: string;
    clarificationCrossWideAttackDescription: string;
    clarificationCrossReceiveFocusQuestion: string;
    clarificationCrossReceiveFocusReason: string;
    clarificationCrossReceiveAerialLabel: string;
    clarificationCrossReceiveAerialDescription: string;
    clarificationCrossReceiveShootingLabel: string;
    clarificationCrossReceiveShootingDescription: string;
    clarificationCrossReceiveBothLabel: string;
    clarificationCrossReceiveBothDescription: string;
    buildIntentUnanalyzedHeading: string;
    buildIntentUnanalyzedIntro: string;
    buildIntentUnanalyzedZeroHeading: string;
    buildIntentUnanalyzedZeroBody: string;
    buildIntentManualSettingsHintText: string;
    buildIntentAdditionalExamplesHeading: string;
    buildIntentAdditionalExampleInsertLabel: string;
    buildIntentAdditionalExampleCrossSupplyLabel: string;
    buildIntentAdditionalExampleCrossSupplyText: string;
    buildIntentAdditionalExampleCrossReceiveLabel: string;
    buildIntentAdditionalExampleCrossReceiveText: string;
    buildIntentAdditionalExampleCrossAmbiguousLabel: string;
    buildIntentAdditionalExampleCrossAmbiguousText: string;
    presetCategoryScoringTitle: string;
    presetCategoryDribblingPossessionTitle: string;
    presetCategoryPassingCreationTitle: string;
    presetCategoryWideCrossingTitle: string;
    presetCategorySpeedCounterTitle: string;
    presetCategoryPhysicalAerialTitle: string;
    presetCategoryDefendingTitle: string;
    presetCategoryGoalkeepingTitle: string;
    presetCategoryBalancedAdjustmentTitle: string;
    presetTagScoring: string;
    presetTagShooting: string;
    presetTagFinisher: string;
    presetTagBox: string;
    presetTagDribbling: string;
    presetTagCross: string;
    presetTagAerial: string;
    presetTagPossession: string;
    presetTagCentral: string;
    presetTagWide: string;
    presetTagSpeed: string;
    presetTagPassing: string;
    presetTagFullback: string;
    presetTagDefending: string;
    presetTagCounter: string;
    presetTagPhysical: string;
    presetTagTarget: string;
    presetTagGoalkeeping: string;
    presetTagBalance: string;
    presetScoringSpecialistTitle: string;
    presetScoringSpecialistShort: string;
    presetScoringSpecialistDetail: string;
    presetBoxFinisherTitle: string;
    presetBoxFinisherShort: string;
    presetBoxFinisherDetail: string;
    presetDribbleToShotTitle: string;
    presetDribbleToShotShort: string;
    presetDribbleToShotDetail: string;
    presetCrossReceiveScoringTitle: string;
    presetCrossReceiveScoringShort: string;
    presetCrossReceiveScoringDetail: string;
    presetAerialScoringTitle: string;
    presetAerialScoringShort: string;
    presetAerialScoringDetail: string;
    presetDribbleBreakthroughTitle: string;
    presetDribbleBreakthroughShort: string;
    presetDribbleBreakthroughDetail: string;
    presetBeatOneOnWingTitle: string;
    presetBeatOneOnWingShort: string;
    presetBeatOneOnWingDetail: string;
    presetTightSpacePossessionTitle: string;
    presetTightSpacePossessionShort: string;
    presetTightSpacePossessionDetail: string;
    presetHardToDispossessTitle: string;
    presetHardToDispossessShort: string;
    presetHardToDispossessDetail: string;
    presetCarryThroughCenterTitle: string;
    presetCarryThroughCenterShort: string;
    presetCarryThroughCenterDetail: string;
    presetCutInsideAttackTitle: string;
    presetCutInsideAttackShort: string;
    presetCutInsideAttackDetail: string;
    presetReceiveAndDistributeTitle: string;
    presetReceiveAndDistributeShort: string;
    presetReceiveAndDistributeDetail: string;
    presetQuicknessFocusTitle: string;
    presetQuicknessFocusShort: string;
    presetQuicknessFocusDetail: string;
    presetPassingSpecialistTitle: string;
    presetPassingSpecialistShort: string;
    presetPassingSpecialistDetail: string;
    presetGameMakingTitle: string;
    presetGameMakingShort: string;
    presetGameMakingDetail: string;
    presetForwardServiceTitle: string;
    presetForwardServiceShort: string;
    presetForwardServiceDetail: string;
    presetDistributeTheBallTitle: string;
    presetDistributeTheBallShort: string;
    presetDistributeTheBallDetail: string;
    presetPossessionAnchorTitle: string;
    presetPossessionAnchorShort: string;
    presetPossessionAnchorDetail: string;
    presetCrossSupplyTitle: string;
    presetCrossSupplyShort: string;
    presetCrossSupplyDetail: string;
    presetDribbleThenCrossTitle: string;
    presetDribbleThenCrossShort: string;
    presetDribbleThenCrossDetail: string;
    presetWideChanceCreationTitle: string;
    presetWideChanceCreationShort: string;
    presetWideChanceCreationDetail: string;
    presetCarryDownLineTitle: string;
    presetCarryDownLineShort: string;
    presetCarryDownLineDetail: string;
    presetCutInsideShootTitle: string;
    presetCutInsideShootShort: string;
    presetCutInsideShootDetail: string;
    presetAttackingFullbackTitle: string;
    presetAttackingFullbackShort: string;
    presetAttackingFullbackDetail: string;
    presetDefensiveFullbackTitle: string;
    presetDefensiveFullbackShort: string;
    presetDefensiveFullbackDetail: string;
    presetSpeedBreakthroughTitle: string;
    presetSpeedBreakthroughShort: string;
    presetSpeedBreakthroughDetail: string;
    presetRunInBehindTitle: string;
    presetRunInBehindShort: string;
    presetRunInBehindDetail: string;
    presetCounterOutletTitle: string;
    presetCounterOutletShort: string;
    presetCounterOutletDetail: string;
    presetSprintDownWingTitle: string;
    presetSprintDownWingShort: string;
    presetSprintDownWingDetail: string;
    presetAerialSpecialistTitle: string;
    presetAerialSpecialistShort: string;
    presetAerialSpecialistDetail: string;
    presetTargetManTitle: string;
    presetTargetManShort: string;
    presetTargetManDetail: string;
    presetPostPlayTitle: string;
    presetPostPlayShort: string;
    presetPostPlayDetail: string;
    presetResistPhysicalContactTitle: string;
    presetResistPhysicalContactShort: string;
    presetResistPhysicalContactDetail: string;
    presetBallWinningSpecialistTitle: string;
    presetBallWinningSpecialistShort: string;
    presetBallWinningSpecialistDetail: string;
    presetMidfieldDestroyerTitle: string;
    presetMidfieldDestroyerShort: string;
    presetMidfieldDestroyerDetail: string;
    presetManMarkingFocusTitle: string;
    presetManMarkingFocusShort: string;
    presetManMarkingFocusDetail: string;
    presetBacklineStabilityTitle: string;
    presetBacklineStabilityShort: string;
    presetBacklineStabilityDetail: string;
    presetShotStoppingFocusTitle: string;
    presetShotStoppingFocusShort: string;
    presetShotStoppingFocusDetail: string;
    presetHighBallFocusTitle: string;
    presetHighBallFocusShort: string;
    presetHighBallFocusDetail: string;
    presetCatchingFocusTitle: string;
    presetCatchingFocusShort: string;
    presetCatchingFocusDetail: string;
    presetSweeperKeeperTitle: string;
    presetSweeperKeeperShort: string;
    presetSweeperKeeperDetail: string;
    presetDistributingGkTitle: string;
    presetDistributingGkShort: string;
    presetDistributingGkDetail: string;
    presetBalancedTypeTitle: string;
    presetBalancedTypeShort: string;
    presetBalancedTypeDetail: string;
    presetAttackLeaningBalanceTitle: string;
    presetAttackLeaningBalanceShort: string;
    presetAttackLeaningBalanceDetail: string;
    presetDefenseLeaningBalanceTitle: string;
    presetDefenseLeaningBalanceShort: string;
    presetDefenseLeaningBalanceDetail: string;
    presetSectionHeading: string;
    presetSearchLabel: string;
    presetSearchPlaceholder: string;
    presetSearchNoResults: string;
    presetRecommendedHeading: string;
    presetCategoryFilterLabel: string;
    presetCategoryAllLabel: string;
    presetPrimaryAbilityAreasLabel: string;
    presetMainSelectLabel: string;
    presetMainSelectedBadge: string;
    presetSubSelectLabel: string;
    presetSubSelectedBadge: string;
    presetSubMaxReachedNotice: string;
    presetClearSelectionLabel: string;
    presetPreviewHeading: string;
    presetPreviewMainLabel: string;
    presetPreviewSubLabel: string;
    presetPreviewNoneSelectedText: string;
    presetPreviewDerivedHeading: string;
    presetSourcePresetLabel: string;
    presetSourceUserLabel: string;
    presetSourceUnspecifiedLabel: string;
    presetDetailSettingsToggleLabel: string;
    presetResetToPresetDefaultsLabel: string;
    presetDiscardManualEditsLabel: string;
    presetConflictHeading: string;
    presetConflictTargetLabel: string;
    presetConflictMainGoalLabel: string;
    presetConflictManualSettingLabel: string;
    presetConflictUsePresetLabel: string;
    presetConflictUseManualLabel: string;
    presetConflictEditManualLabel: string;
    presetConflictBlocksConfirmNotice: string;
    presetConfirmButtonLabel: string;
    presetConfirmedNoticeHeading: string;
    presetConfirmedMainLabel: string;
    presetConfirmedSubLabel: string;
    presetConfirmedUserModifiedLabel: string;
    presetConfirmedUserModifiedYes: string;
    presetConfirmedUserModifiedNo: string;
    presetReturnToGeneralAnalysisLabel: string;
    presetChangeIntentButtonLabel: string;
    presetChangedNotConfirmedNotice: string;
    presetChangedCurrentSelectionLabel: string;
    presetChangedInUseLabel: string;
    presetAnalyzeWithNewLabel: string;
    presetRevertToPreviousLabel: string;
    presetDetailChangedNotice: string;
    presetAnalyzeWithChangedSettingsLabel: string;
    presetRevertDetailChangesLabel: string;
    presetDeselectedNotice: string;
    presetKeepPreviousSelectionLabel: string;
    presetReflectionHeading: string;
    presetReflectionSourceLabel: string;
    presetReflectionSourcePresetPlusUser: string;
    presetReflectionSourcePresetOnly: string;
    presetReflectionSourceManualOnly: string;
    presetReflectionSourceNone: string;
    presetReflectionStatusLabel: string;
    presetReflectionStatusConfirmed: string;
    presetReflectionUnconfirmedNotice: string;
    presetReflectionUnconfirmedMainChange: string;
    presetReflectionUnconfirmedDetailChange: string;
    presetCarriedOverNotice: string;
    buildIntentStatusNotInputText: string;
    buildIntentStatusNotAnalyzedText: string;
    buildIntentStatusAnalyzingText: string;
    buildIntentStatusAwaitingConfirmationText: string;
    buildIntentStatusConfirmedText: string;
    buildIntentStatusStaleText: string;
    buildIntentStatusFailedText: string;
    buildIntentStatusNotConfiguredText: string;
    buildIntentStatusManualText: string;
    intentGoalUnspecified: string;
    intentGoalScoring: string;
    intentGoalDribbling: string;
    intentGoalPassing: string;
    intentGoalSpeed: string;
    intentGoalPossession: string;
    intentGoalPhysical: string;
    intentGoalAerial: string;
    intentGoalDefense: string;
    intentGoalPress: string;
    intentGoalCounter: string;
    intentGoalBalance: string;
    intentGoalOther: string;
    intentReflectionHeading: string;
    intentReflectionUnspecifiedToggleLabel: string;
    intentReflectionFieldPrimaryGoal: string;
    intentReflectionFieldPosition: string;
    intentReflectionFieldPriorityGroups: string;
    intentReflectionFieldLowerPriorityGroups: string;
    intentReflectionFieldAvoidOverinvestmentGroups: string;
    intentReflectionFieldIntentionallyIgnoredGroups: string;
    intentReflectionFieldComparisonTarget: string;
    intentReflectionFieldFreeText: string;
    intentReflectionFieldStrengthsToPreserve: string;
    intentReflectionStatusUsed: string;
    intentReflectionStatusReferenceOnly: string;
    intentReflectionStatusDisplayOnly: string;
    intentReflectionStatusNotSpecified: string;
    intentReflectionStatusLimitedByData: string;
    intentAlignmentLabel: string;
    intentAlignmentHigh: string;
    intentAlignmentMostlyAligned: string;
    intentAlignmentPartiallyAligned: string;
    intentAlignmentPoorlyAligned: string;
    intentAlignmentInsufficientInformation: string;
    generalEvaluationHeading: string;
    intentEvaluationHeading: string;
    intentEvaluationEmptyGuidance: string;
    intentConclusionHeading: string;
    intentAlignedHeading: string;
    intentMisalignmentHeading: string;
    intentOverinvestmentHeading: string;
    intentAcceptableLowHeading: string;
    intentNotAProblemHeading: string;
    intentComparisonHeading: string;
    intentImprovementHeading: string;
    intentFinalHeading: string;
    intentNoneText: string;
    buildIntentEvidenceHeading: string;
    intentContextTemplate: string;
    intentContextWithPositionTemplate: string;
    intentConclusionWithIssueTemplate: string;
    intentConclusionNoIssueTemplate: string;
    intentConclusionIssueNotReflectedTemplate: string;
    intentConclusionIssueUnderprioritizedTemplate: string;
    intentConclusionIssueAvoidOverinvestmentTemplate: string;
    intentConclusionIssueOverinvestmentTemplate: string;
    intentConclusionAlignmentHigh: string;
    intentConclusionAlignmentMostlyAligned: string;
    intentConclusionAlignmentPartiallyAligned: string;
    intentConclusionAlignmentPoorlyAligned: string;
    intentConclusionAlignmentInsufficientInformation: string;
    intentConclusionAlignmentAndImprovementTemplate: string;
    intentAlignedGroupStronglyWithAbilitiesTemplate: string;
    intentAlignedGroupStronglyTemplate: string;
    intentAlignedGroupMostlyWithAbilitiesTemplate: string;
    intentAlignedGroupMostlyTemplate: string;
    intentAlignedNoneText: string;
    intentMisalignmentNoneText: string;
    intentNotAProblemNoneText: string;
    intentAbilityDeltaItemTemplate: string;
    intentAbilityListSeparator: string;
    intentFindingPriorityNotReflected: string;
    intentFindingPriorityUnderprioritized: string;
    intentFindingPriorityInsufficientData: string;
    intentFindingPrimaryGoalReflected: string;
    intentFindingPrimaryGoalMismatch: string;
    intentFindingLowerPriorityLowAllocationGood: string;
    intentAcceptableLowOnlyTemplate: string;
    intentAcceptableExcludedOnlyTemplate: string;
    intentAcceptableLowAndExcludedTemplate: string;
    intentFindingNearComplete: string;
    intentFindingSpreadNotAProblem: string;
    intentFindingOverinvestmentOutsidePriorityNormal: string;
    intentFindingOverinvestmentOutsidePriorityHarsh: string;
    intentFindingGoalAuxiliaryOnly: string;
    intentFindingInsufficientAbilityData: string;
    intentFindingPriorityCountMany: string;
    intentFindingPriorityCountAll: string;
    intentFindingLowerPriorityCountMost: string;
    intentComparisonCurrentCloserTemplate: string;
    intentComparisonCurrentCloserDetailedTemplate: string;
    intentComparisonOtherCloserTemplate: string;
    intentComparisonOtherCloserDetailedTemplate: string;
    intentComparisonSimilarTemplate: string;
    intentComparisonSimilarWithGroupsTemplate: string;
    intentComparisonConditionDiffersTemplate: string;
    intentComparisonInsufficientDataTemplate: string;
    intentTopIssueNotReflectedTemplate: string;
    intentTopIssueUnderprioritizedTemplate: string;
    intentTopIssueAvoidOverinvestmentTemplate: string;
    intentTopIssueOverinvestmentTemplate: string;
    intentTopIssueNoneTemplate: string;
    intentPreserveTemplate: string;
    intentPreserveNoneTemplate: string;
    intentStateSecondary: string;
    buildIntentStatusConfirmedModifiedText: string;
    intentReflectionFieldSecondaryPriorityGroups: string;
    intentConclusionIssueSecondaryNotReflectedTemplate: string;
    intentConclusionIssuePriorityInversionTemplate: string;
    intentTopIssueSecondaryNotReflectedTemplate: string;
    intentTopIssuePriorityInversionTemplate: string;
    intentFindingSecondaryNotReflected: string;
    intentFindingSecondaryPriorityInversion: string;
    intentFindingSecondaryPriorityInversionReview: string;
    intentConfirmationHeading: string;
    intentSecondaryHeading: string;
    intentSecondaryAlignedWithAbilitiesTemplate: string;
    intentSecondaryAlignedTemplate: string;
    intentSecondaryInsufficientDataTemplate: string;
    intentPreserveSecondaryTemplate: string;
    intentPreserveUnconfirmedTemplate: string;
    buildIntentManualNotice: string;
    buildIntentConfirmedModifiedNotice: string;
    buildIntentStaleUsingPreviousNotice: string;
    intentReflectionSourceLabel: string;
    buildIntentSourceAiConfirmedLabel: string;
    buildIntentSourceAiModifiedLabel: string;
    buildIntentSourceManualLabel: string;
    buildIntentSourceStaleLabel: string;
    buildIntentSourceNotConfiguredLabel: string;
    buildIntentSourceGeneralOnlyLabel: string;
    buildIntentMethodNotice: string;
    comparisonSummaryHeading: string;
    comparisonTargetBadgeLabel: string;
    comparisonTargetNotFoundText: string;
    comparisonDetailsToggleLabel: string;
    comparisonPurposeClosenessLabel: string;
    comparisonPurposeDiffLabel: string;
    comparisonMajorDiffLabel: string;
    comparisonDifferentiationLabel: string;
    comparisonRecommendationLabel: string;
    comparisonOverallSimilarityLabel: string;
    comparisonPurposeSimilaritySamePurposeText: string;
    comparisonPurposeSimilarityClosePurposeText: string;
    comparisonPurposeSimilarityDifferentPurposeText: string;
    comparisonPurposeSimilarityNotSetText: string;
    comparisonPurposeSimilarityUnknownText: string;
    comparisonPurposeDiffVerySmallText: string;
    comparisonPurposeDiffSmallText: string;
    comparisonPurposeDiffSomeText: string;
    comparisonPurposeDiffClearText: string;
    comparisonPurposeDiffInsufficientDataText: string;
    comparisonDifferentiationWellText: string;
    comparisonDifferentiationPartialText: string;
    comparisonDifferentiationLimitedText: string;
    comparisonDifferentiationNotAssessableText: string;
    comparisonOverallVerySimilarText: string;
    comparisonOverallSimilarText: string;
    comparisonOverallPartiallyDifferentText: string;
    comparisonOverallClearlyDifferentText: string;
    comparisonOverallUnknownText: string;
    comparisonGeneralOnlyNoticeText: string;
    comparisonInsufficientAbilityDataText: string;
    comparisonPartiallyComparableGeneralOnlyText: string;
    comparisonMajorDiffCurrentHigherTemplate: string;
    comparisonMajorDiffOtherHigherTemplate: string;
    comparisonNoMajorDiffText: string;
    comparisonRecommendationMaintainText: string;
    comparisonRecommendationDifferentiateTemplate: string;
    comparisonRecommendationSetPurposeText: string;
    comparisonRecommendationInsufficientDataText: string;
    comparisonRecommendationNotComparableText: string;
    comparisonRecommendationGeneralOnlyText: string;
    comparisonDetailUsedPointsLabel: string;
    comparisonDetailRemainingPointsLabel: string;
    comparisonDetailOvrLabel: string;
    comparisonDetailAllocationDiffLabel: string;
    comparisonDetailAbilityDiffLabel: string;
    comparisonDetailCurrentHigherLabel: string;
    comparisonDetailOtherHigherLabel: string;
    comparisonDetailNoDiffText: string;
    comparisonDetailLimitationsLabel: string;
    diagnosisCardHeading: string;
    diagnosisCardShowLabel: string;
    diagnosisCardHideLabel: string;
    diagnosisCardGuidanceNoIntentText: string;
    diagnosisCardPendingChangesNotice: string;
    diagnosisCardAlignmentLabel: string;
    diagnosisCardAlignmentHighText: string;
    diagnosisCardAlignmentMostlyText: string;
    diagnosisCardAlignmentPartiallyText: string;
    diagnosisCardAlignmentPoorlyText: string;
    diagnosisCardAlignmentAbilityDataText: string;
    diagnosisCardAlignmentNeedsConfirmationText: string;
    diagnosisCardHeadlineInsufficientAbilityDataTemplate: string;
    diagnosisCardHeadlineWellAlignedNormalTemplate: string;
    diagnosisCardHeadlineWellAlignedHarshTemplate: string;
    diagnosisCardHeadlineWellAlignedImprovementNormalTemplate: string;
    diagnosisCardHeadlineWellAlignedImprovementHarshTemplate: string;
    diagnosisCardHeadlineClearIssueNormalTemplate: string;
    diagnosisCardHeadlineClearIssueHarshTemplate: string;
    diagnosisCardHeadlineConfirmationNormalTemplate: string;
    diagnosisCardHeadlineConfirmationHarshTemplate: string;
    diagnosisCardHeadlineNeedsReviewNormalTemplate: string;
    diagnosisCardHeadlineNeedsReviewHarshTemplate: string;
    achievementsHeading: string;
    diagnosisCardNoAchievementsText: string;
    concernHeading: string;
    diagnosisCardConcernInsufficientDataText: string;
    diagnosisCardConcernNoneText: string;
    preserveHighlightHeading: string;
    diagnosisCardPreserveUnconfirmedText: string;
    imageSaveButtonLabel: string;
    imageSaveButtonAriaLabel: string;
    imagePreviewHeading: string;
    imageOrientationLabel: string;
    imageOrientationPortraitLabel: string;
    imageOrientationLandscapeLabel: string;
    imageModeGroupAriaLabel: string;
    imageSaveConfirmLabel: string;
    imageGeneratingText: string;
    imageSuccessText: string;
    imageFailedText: string;
    imagePendingChangesBlockedText: string;
    imageNormalDiagnosisLabel: string;
    imageHarshDiagnosisLabel: string;
    imageFooterText: string;
    savedIntentHeading: string;
    savedIntentStatusSaved: string;
    savedIntentStatusUnsaved: string;
    savedIntentSaveGroupAriaLabel: string;
    savedIntentSavingText: string;
    savedIntentSaveButtonLabel: string;
    savedIntentUpdateButtonLabel: string;
    savedIntentRevertToSavedLabel: string;
    savedIntentDeleteConfirmText: string;
    savedIntentDeleteOnlyLabel: string;
    savedIntentDeleteCancelLabel: string;
    savedIntentDeletingText: string;
    savedIntentDeleteButtonLabel: string;
    savedIntentUnsavedNoticeText: string;
    savedIntentNoConfirmedIntentText: string;
    savedIntentUpToDateText: string;
    savedIntentDivergedText: string;
    savedIntentPendingChangesText: string;
    savedIntentSaveSuccessText: string;
    savedIntentSaveFailedText: string;
    savedIntentDeleteFailedText: string;
    savedIntentPresetUnresolvedText: string;
    savedIntentComparisonTargetMissingText: string;
  };
  worldPlayerSearchCard: {
    disabledAriaTemplate: string;
    enabledAriaTemplate: string;
    cannotAddFallback: string;
    ovrTooltip: string;
    noEnglishName: string;
    maxOvrLabel: string;
    levelCapLabel: string;
    noTeamInfo: string;
    pomTooltip: string;
    fixedProvisionalTooltip: string;
    fixedTooltip: string;
    unresolvedTooltip: string;
    pomChipTemplate: string;
    fixedProvisionalChipTemplate: string;
    fixedChipTemplate: string;
    unresolvedChip: string;
    noAttachedBoosters: string;
    detailLink: string;
    detailNewTabSuffix: string;
    unknownCardType: string;
    unknownPosition: string;
    maxOvrTemplate: string;
    noOvrInfoLabel: string;
    cardImageAltTemplate: string;
  };
  addPlayerSearch: {
    selectCardHeadingTemplate: string;
    closeButton: string;
    maxPlayersNoteTemplate: string;
    searchPlaceholder: string;
    searchAriaLabelTemplate: string;
    duplicateNote: string;
    minLengthPromptTemplate: string;
    tooShortTemplate: string;
    searchFailedError: string;
    retryButton: string;
    noResults: string;
    resultCountTemplate: string;
    addingLabel: string;
    addToSlotTemplate: string;
    alreadyAddedReason: string;
    processingReason: string;
    addFailedError: string;
  };
  playerSearchPanel: {
    searchAriaLabel: string;
    duplicateNotePrefix: string;
    sortNoteWithPositionTemplate: string;
    sortNoteDefault: string;
    placedLabel: string;
    placedWithLocationTemplate: string;
  };
  formationSelect: {
    ariaLabel: string;
  };
  squadTemplatesBoard: {
    storageUnavailableHeading: string;
    storageUnavailableNote: string;
    backToSquadListLink: string;
    createEmptyHeading: string;
    createEmptyNote: string;
    templateNameLabel: string;
    newTemplateNameAria: string;
    formationLabel: string;
    createButton: string;
    defaultEmptyTemplateName: string;
    templatesHeadingTemplate: string;
    templatesCountSuffixTemplate: string;
    loadingText: string;
    noTemplatesNote: string;
    emptyTypeBadge: string;
    fullTypeBadge: string;
    customPlacementBadge: string;
    startersTemplate: string;
    benchTemplate: string;
    hasManagerLabel: string;
    noManagerLabel: string;
    createFromTemplateButton: string;
    renameButton: string;
    deleteButton: string;
    newSquadNamePrompt: string;
    templateNamePrompt: string;
    deleteConfirmTemplate: string;
    deleteConfirmButton: string;
    cancelDeleteButton: string;
    backToSquadListButton: string;
  };
  slotPlayerPanel: {
    slotSuffix: string;
    movingCancelButton: string;
    emptySlotNote: string;
    addPlayerButton: string;
    placementRoleLabel: string;
    autoInferredTemplate: string;
    suitabilityLabelTemplate: string;
    adjustPositionButton: string;
    roleLabel: string;
    roleAriaLabelTemplate: string;
    autoRoleOptionTemplate: string;
    baseToDisplayedOvrPrefixTemplate: string;
    estimateNote: string;
    progressionDeltaTemplate: string;
    playerBoosterDeltaTemplate: string;
    managerDeltaTemplate: string;
    cannotProgressNote: string;
    attachedBoosterSlotTemplate: string;
    powerOfManyNote: string;
    verifiedScreenTemplate: string;
    externalVerifiedTemplate: string;
    underVerificationNote: string;
    fixedTypeEstimateSuffix: string;
    experimentalBoosterPrefix: string;
    experimentalBoosterTeamNote: string;
    experimentalBoosterSuffix: string;
    noBoosterOption: string;
    boosterIdMismatchNote: string;
    progressionPolicyLabel: string;
    buildModeAriaTemplate: string;
    savedBuildOptionTemplate: string;
    savedBuildAriaTemplate: string;
    applySavedBuildOption: string;
    legacyRuleSuffix: string;
    squadBuildLabel: string;
    notSetLabel: string;
    notFoundDeletedLabel: string;
    chooseSavedBuildButton: string;
    staleBuildNote: string;
    moveSwapButton: string;
    moveToBenchButton: string;
    removeFromSlotButton: string;
    clearCaptainButton: string;
    setCaptainButton: string;
    compareFullLabel: string;
    playerDetailLink: string;
    progressionLinkLabel: string;
    boosterSlotAriaTemplate: string;
    boosterLevelAriaTemplate: string;
  };
  squadPitch: {
    compatExactTitle: string;
    compatRelatedTitle: string;
    compatUnresolvedTitle: string;
    compatMismatchTitle: string;
    compatEmptyTitle: string;
    snapLabelTemplate: string;
    freePlacementLabel: string;
    guideHorizontalLabel: string;
    guideCenterLabel: string;
    guideSymmetryLabel: string;
    moveTargetPrefix: string;
    moveSourcePrefix: string;
    occupiedSlotAriaTemplate: string;
    moveTargetSwapSuffix: string;
    emptySlotAriaTemplate: string;
    moveTargetMoveHereLabel: string;
    addPlayerLabel: string;
  };
  compareSaveBuildDialog: {
    defaultName: string;
    nameRequiredError: string;
    saveFailedTemplate: string;
    saveErrorGeneric: string;
    modalTitleTemplate: string;
    intro: string;
    allocationHeadingTemplate: string;
    buildNameLabel: string;
    buildNameAriaLabel: string;
    saveMethodLegend: string;
    saveAsNewOption: string;
    overwriteExistingOption: string;
    overwriteSelectAriaLabel: string;
    includePomLabel: string;
    pomCurrentTemplate: string;
    pomUnspecifiedNote: string;
    pomNoSpecificValue: string;
    footnote: string;
    cancelButton: string;
    overwriteWarningTemplate: string;
    overwriteSaveButton: string;
    confirmOverwriteButton: string;
    savingButton: string;
    saveButton: string;
  };
  compareCategoryPreview: {
    headingTemplate: string;
    headingHint: string;
    noInfoTemplate: string;
    valueAriaLabelTemplate: string;
    personPrefixTemplate: string;
    diffLabelTemplate: string;
    statusLineTemplate: string;
    footnote: string;
  };
  compareRadarChart: {
    seriesStyleSolid: string;
    seriesStyleDashedSquare: string;
    seriesStyleDottedTriangle: string;
    seriesStyleDashDotDiamond: string;
    altLinePersonTemplate: string;
    graphDisplayLabel: string;
    personOrdinalTemplate: string;
    showPreBuildTemplate: string;
    showPreBuildFallback: string;
    chartAriaLabelTemplate: string;
    legendPersonTemplate: string;
    categoryValuesSummaryTemplate: string;
    playerHeader: string;
    managerNote: string;
  };
  comparisonTables: {
    deltaProgressionPrefix: string;
    deltaPlayerBoosterPrefix: string;
    deltaConditionalPrefix: string;
    deltaManagerBoosterPrefix: string;
    rulesLabel: string;
    estimatedOvrLabel: string;
    boosterModePrefix: string;
    boosterModeStandard: string;
    boosterModeNoteSuffix: string;
    basicInfoHeading: string;
    itemHeader: string;
    positionMatchLabel: string;
    yes: string;
    no: string;
    categoryHeading: string;
    categoryHeadingHint: string;
    categoryHeader: string;
    diffHeader: string;
    avgTemplate: string;
    totalRowLabel: string;
    abilitiesHeading: string;
    conditionalToggleLabel: string;
    conditionalNote: string;
    abilityHeader: string;
    legendPrefix: string;
    legendProgression: string;
    legendPlayerBooster: string;
    legendStandardMode: string;
    legendPlayerBoosterDetailSuffix: string;
    legendConditional: string;
    legendManagerBooster: string;
    legendSuffix: string;
    legendHighestColor: string;
    legendDisplaySuffix: string;
    skillsHeading: string;
    playerSkillsTitle: string;
    aiStylesTitle: string;
    countLabel: string;
    sharedByAllTemplate: string;
    noneLabel: string;
    partialTitle: string;
    uniqueToPlayerTemplate: string;
  };
  comparisonCockpit: {
    abilitiesTableLink: string;
    backToTrainingLink: string;
    ariaLabel: string;
    heading: string;
    headingHint: string;
    selectPlayerAriaLabel: string;
    playerTabTemplate: string;
    activeSuffix: string;
  };
  compareTrainingPanel: {
    cannotProgressNote: string;
    autoAllocatedAnnounceTemplate: string;
    resetButton: string;
    resetAnnounceTemplate: string;
    saveThisBuildButton: string;
    autoAllocateNote: string;
    usedPointsLabel: string;
    remainingPointsLabel: string;
    overAllocatedLabel: string;
    totalPointsLabel: string;
    gkHeading: string;
    gkLevelLabelTemplate: string;
    gkExpandedSuffix: string;
    gkCollapsedSuffix: string;
    definitionNote: string;
    manualSuffix: string;
    embeddedHeadingTemplate: string;
    collapsedHeading: string;
  };
  comparePlayerIdentityCard: {
    cardImageAltTemplate: string;
    noEnglishName: string;
    ovrTooltip: string;
    ovrLineTemplate: string;
    pomChipTooltip: string;
    fixedProvisionalTooltip: string;
    fixedTooltip: string;
    unresolvedTooltip: string;
    pomChipTemplate: string;
    fixedChipTemplate: string;
    provisionalSuffix: string;
    unresolvedChip: string;
    noAttachedBoosters: string;
    pomSelectionLabelTemplate: string;
    currentTrainingTemplate: string;
    playerDetailLink: string;
    progressionScreenLink: string;
  };
  playerControlColumn: {
    removeAriaTemplate: string;
    savedBuildTrainingLabelTemplate: string;
    manualTrainingLabel: string;
    followsPolicyLabel: string;
    trainingPolicyLabel: string;
    trainingPolicyAriaTemplate: string;
    savedBuildOptionTemplate: string;
    manualTrainingOption: string;
    applyBuildAriaTemplate: string;
    applyBuildDefaultOption: string;
    trainingConsolidatedNoteTemplate: string;
    positionFitSummary: string;
    registeredPositionLabel: string;
    currentOverallLabel: string;
    currentOverallValue: string;
    currentOverallNote: string;
    overallExplanation: string;
    attachedBoosterPrefixTemplate: string;
    powerOfManyNote: string;
    verifiedScreenshotNoteTemplate: string;
    fixedEstimateSuffix: string;
    externalCrossVerifiedNoteTemplate: string;
    underVerificationNote: string;
    additionalBoosterPrefix: string;
    additionalBoosterHighlight: string;
    additionalBoosterSuffix: string;
    boosterLevelAriaTemplate: string;
    additionalBoosterAriaTemplate: string;
    noneOption: string;
    boosterFootnotePrefix: string;
    boosterFootnoteHighlight: string;
    boosterFootnoteSuffix: string;
    managerLabel: string;
    managerClearButton: string;
    noManagerLabel: string;
    managerChangeButton: string;
    managerChooseButton: string;
  };
  comparisonBoard: {
    sameTrainingLabel: string;
    sameManagerLabel: string;
    chooseFromManagerListButton: string;
    clearAllManagersButton: string;
    perPlayerManagerNote: string;
    sharedManagerPickerTitle: string;
    perPlayerManagerPickerTitleTemplate: string;
    fallbackPlayerName: string;
    maxPlayersErrorTemplate: string;
    duplicateCardError: string;
    fetchPlayerFailedError: string;
    fetchPlayerErrorGeneric: string;
    buildSavedNoticeTemplate: string;
    confirmOverwriteWarningTemplate: string;
    overwriteTargetsLabel: string;
    overwriteTargetTemplate: string;
    overwriteApplyButton: string;
    overwriteCancelButton: string;
    selectSlotOrdinalTemplate: string;
    addPlayerToSlotButtonTemplate: string;
    maxPlayersNoteTemplate: string;
    needTwoPlayersTitle: string;
    needTwoPlayersDescriptionTemplate: string;
    browseHighOvrButton: string;
  };
  comparePage: {
    title: string;
    description: string;
    backToPlayers: string;
    dataUnavailableTitle: string;
    dataUnavailableDescription: string;
  };
  worldPlayerHero: {
    backToList: string;
    noImage: string;
    maxOvrLabel: string;
    baseAndCapTemplate: string;
    noEnglishName: string;
    idBadgeTemplate: string;
    baseOvrLabel: string;
    maxOvrFactLabel: string;
    maxLevelLabel: string;
    preferredFootLabel: string;
    heightWeightTemplate: string;
    teamLabel: string;
  };
  playerDetailPage: {
    worldDataUnavailableTitle: string;
    worldDataUnavailableDescription: string;
    backToPlayerList: string;
    analysisScopeWorldEfhub: string;
    analysisScopeWorld: string;
    nationalityLabel: string;
    regionLabel: string;
    leagueLabel: string;
    teamLabel: string;
    ageLabel: string;
    heightLabel: string;
    weightLabel: string;
    preferredFootLabel: string;
    playingStyleLabel: string;
    playingStyleDefLabel: string;
    booster1Label: string;
    booster2Label: string;
    basicInfoHeading: string;
    statsHeading: string;
    statsHint: string;
    playerSkillsHeading: string;
    noSkills: string;
    aiStylesHeading: string;
    noAiStyles: string;
    progressionHeading: string;
    dataProvenanceHeading: string;
    dataSourceLabel: string;
    sourceUrlLabel: string;
    appearanceUpdatedLabel: string;
    fetchedAtLabel: string;
    efhubDiffHeading: string;
    tableItemHeader: string;
    tableWorldHeader: string;
    tableEfhubHeader: string;
    notYetHeading: string;
    notYetHint: string;
    notYetZeroNote: string;
    notYetBadgeSuffix: string;
    notYetSecondaryPosition: string;
    tabsAriaLabel: string;
    tabOverview: string;
    tabStats: string;
    tabSkills: string;
    tabProgression: string;
    tabData: string;
  };
  legacyPlayerDetail: {
    backToList: string;
    noJapaneseName: string;
    noEnglishName: string;
    efhubIdLabel: string;
    ovrLabel: string;
    provenanceHeading: string;
    dataSourceLabel: string;
    sourceUrlLabel: string;
    httpMethodLabel: string;
    fetchedAtLabel: string;
    noSourceInfo: string;
    futureHeading: string;
    futureDescription: string;
    imageProxyNote: string;
  };
  worldFilters: {
    sortOvrMaxDesc: string;
    sortOvrMaxAsc: string;
    sortOvrBaseDesc: string;
    sortOvrBaseAsc: string;
    sortName: string;
    sortUpdatedDesc: string;
    filterLabelQ: string;
    filterLabelPosition: string;
    filterLabelCardType: string;
    filterLabelPlayingStyle: string;
    filterLabelPlayingStyleDef: string;
    filterLabelMinOvr: string;
    filterLabelMaxOvr: string;
    filterLabelBooster: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    sortAriaLabel: string;
    filterToggleTemplate: string;
    positionAriaLabel: string;
    positionAll: string;
    cardTypeAriaLabel: string;
    cardTypeAll: string;
    playingStyleAriaLabel: string;
    playingStyleAll: string;
    playingStyleDefAriaLabel: string;
    playingStyleDefAll: string;
    minOvrPlaceholder: string;
    minOvrAriaLabel: string;
    maxOvrPlaceholder: string;
    maxOvrAriaLabel: string;
    clearAllButton: string;
  };
  worldPlayerCard: {
    noEnglishName: string;
    baseOvrLabel: string;
    levelCapLabel: string;
  };
  worldPagination: {
    ariaLabel: string;
    rangeTemplate: string;
    prevLabel: string;
    nextLabel: string;
    pageOfTemplate: string;
  };
  playersPage: {
    title: string;
    metaTemplate: string;
    descriptionTemplate: string;
    importedAtPrefix: string;
    compareLink: string;
    noDataTitle: string;
    noDataDescription: string;
    loadErrorTitle: string;
    loadErrorDescription: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearAllFiltersButton: string;
    noCardsTitle: string;
    noCardsDescription: string;
    showingRangeTemplate: string;
    dataSourcePrefix: string;
    defaultSourceName: string;
  };
  tagEditor: {
    duplicateTag: string;
    maxTagsTemplate: string;
    labelTemplate: string;
    removeTagAriaTemplate: string;
    placeholder: string;
    addButton: string;
  };
  myTeamAddDialog: {
    editTitle: string;
    addTitle: string;
    saveFailedFallback: string;
    introAddTemplate: string;
    introEditTemplate: string;
    ownershipLabel: string;
    usageLabel: string;
    usageNote: string;
    noteLabelTemplate: string;
    notePlaceholder: string;
    noteCountTemplate: string;
    cancelButton: string;
    saveButton: string;
    addButton: string;
  };
  myTeamButton: {
    registeredAria: string;
    registeredLabel: string;
    openInMyTeamLink: string;
    addButton: string;
    unavailableNote: string;
  };
  favoritesView: {
    pageTitle: string;
    pageDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    noResultsTitle: string;
    removeLabel: string;
  };
  favoriteButton: {
    saveFailedFallback: string;
    removeLabel: string;
    addLabel: string;
    favoritedCompactLabel: string;
    notFavoritedCompactLabel: string;
    favoritedLabel: string;
    addFavoriteLabel: string;
    unavailableNote: string;
  };
  userCardFilters: {
    sortAddedDesc: string;
    sortAddedAsc: string;
    sortOvrDesc: string;
    sortOvrAsc: string;
    sortName: string;
    sortPosition: string;
    searchSrLabel: string;
    searchPlaceholder: string;
    sortAriaLabel: string;
    positionFilterAriaLabel: string;
    positionFilterAll: string;
    cardTypeFilterAriaLabel: string;
    cardTypeFilterAll: string;
    ownershipFilterAriaLabel: string;
    ownershipFilterAll: string;
    ownershipOwned: string;
    ownershipWanted: string;
    ownershipReleased: string;
    ownershipUnknown: string;
    inTeamFilterAriaLabel: string;
    inTeamFilterAll: string;
    inTeamFilterYes: string;
    inTeamFilterNo: string;
    boosterFilterAriaLabel: string;
    boosterFilterAll: string;
    boosterFilterHas: string;
    boosterFilterPom: string;
    clearFiltersButton: string;
    countTemplate: string;
  };
  userCardTile: {
    compareAddedMsg: string;
    compareAlreadyMsg: string;
    compareFullMsg: string;
    compareFailedMsg: string;
    resolvingCardInfo: string;
    boosterGold: string;
    boosterBlue: string;
    noBuildsSaved: string;
    selectedBuildTemplate: string;
    buildsSavedTemplate: string;
    usedInSquadsCountTemplate: string;
    detailLink: string;
    progressionLink: string;
    addToCompareButton: string;
    defaultRemoveLabel: string;
    ownershipOwned: string;
    ownershipWanted: string;
    ownershipReleased: string;
    ownershipUnknown: string;
    usageMain: string;
    usageRotation: string;
    usageReserve: string;
    usageUnused: string;
    usageUnknown: string;
  };
  localStorageNotice: {
    whatFavorites: string;
    whatMyTeam: string;
    whatBuilds: string;
    whatFavoritesAndMyTeam: string;
    bodyPrefixTemplate: string;
    bodyBold: string;
    bodySuffix: string;
  };
  myTeam: {
    pageTitle: string;
    pageDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    findPlayersLink: string;
    viewFavoritesLink: string;
    notAvailableNotice: string;
    ownedCardCountLabel: string;
    totalFavoriteCountLabel: string;
    mainCardCountLabel: string;
    buildsSavedCountLabel: string;
    buildsSavedNote: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFiltersButton: string;
    resolvingCards: string;
    editButton: string;
    useInSquadLink: string;
    removeFromMyTeamLabel: string;
    savedBuildHeading: string;
    selectedPrefix: string;
    favoritePrefix: string;
    noneLabel: string;
    buildMissingLabel: string;
    savedCountSuffix: string;
    quickSelectLabel: string;
    quickSelectNone: string;
    legacyRulesSuffix: string;
    chooseBuildButton: string;
    openInProgressionLink: string;
    removeConfirmTitle: string;
    removeConfirmButton: string;
    removeConfirmBodyTemplate: string;
    removeConfirmNote: string;
    customUsageSuffix: string;
    starterUsageTemplate: string;
    captainUsageSuffix: string;
    benchUsageLabel: string;
    selectedBuildAriaTemplate: string;
  };
  bench: {
    modeNone: string;
    modeAttack: string;
    modeDefense: string;
    modeBalance: string;
    modeGk: string;
    heading: string;
    addButton: string;
    empty: string;
    moveCandidatePrefix: string;
    movingPrefix: string;
    benchSlotLabel: string;
    moveSwapSuffix: string;
    moveStartSuffix: string;
    positionUnknown: string;
    displayedOvrPrefix: string;
    ovrUnknown: string;
    loadingLabel: string;
    errorLabel: string;
    moveUpAriaTemplate: string;
    moveDownAriaTemplate: string;
    removeButton: string;
    staleBuildLabel: string;
    buildModeAriaTemplate: string;
    squadBuildLabelPrefix: string;
    buildNotSet: string;
    buildDeleted: string;
    chooseBuildButton: string;
    moveToBenchAria: string;
    moveToBenchButton: string;
  };
  bestXi: {
    pageTitle: string;
    heading: string;
    description: string;
    disclaimerNotAi: string;
    modeLabel: string;
    modeDescription: string;
    formationNotice: string;
    criteriaHeading: string;
    criteriaFilledSlots: string;
    criteriaExactPosition: string;
    criteriaRelatedMinimized: string;
    criteriaPositionRatingBalance: string;
    criteriaAbilityDataConfidence: string;
    criteriaIntentSupplementary: string;
    resultStatsTemplate: string;
    candidatePoolTemplate: string;
    generateButton: string;
    regenerateButton: string;
    generatingText: string;
    staleNoticeText: string;
    emptyMyTeamHeading: string;
    emptyMyTeamBody: string;
    goToMyTeamLink: string;
    goToBuildInventoryLink: string;
    unfilledSlotsHeading: string;
    unfilledSlotNoCandidate: string;
    unfilledSlotOnlyIneligibleCandidates: string;
    needMorePlayersTemplate: string;
    needOnePlayerText: string;
    addPlayersHint: string;
    selectedBuildLabel: string;
    noSavedBuildLabel: string;
    suitabilityLabel: string;
    suitabilityExact: string;
    suitabilityRelated: string;
    suitabilityUnresolved: string;
    positionRatingLabel: string;
    positionRatingUnavailable: string;
    reasonsHeading: string;
    reasonExactPosition: string;
    reasonTopPositionRating: string;
    reasonOnlyEligibleCandidate: string;
    reasonBestBuildAmongOwnBuilds: string;
    reasonFullAbilityDataConfirmed: string;
    reasonNoSavedBuildUsesBaseStats: string;
    reasonIntentPositionMatch: string;
    reasonOptimalOverallPlacement: string;
    alternativesHeading: string;
    alternativesEmptyText: string;
    alternativesSlotPrefixTemplate: string;
    exclusionSameCardBuildUsedElsewhere: string;
    exclusionLowerPositionRating: string;
    exclusionLowerSuitability: string;
    exclusionAbilityDataUnavailable: string;
    exclusionUsedInOtherRequiredSlot: string;
    exclusionNoAppropriateSlotInFormation: string;
    exclusionLegacyRulesLimitedComparison: string;
    exclusionPositionSuitabilityUnresolved: string;
    exclusionGkFieldMismatch: string;
    limitationsHeading: string;
    limitationSingleFormationOnly: string;
    limitationNoBenchSelection: string;
    limitationNoManagerSelection: string;
    limitationPersonIdentityUnavailable: string;
    limitationAdditionalPositionAptitudeLimited: string;
    limitationLargeCandidatePoolBounded: string;
    notAWinPredictionText: string;
    resultsNotSavedText: string;
    withinYourCandidatesText: string;
    unavailableCardNoWorldCardData: string;
    unavailableCardNoAbilityData: string;
    unavailableCardsHeading: string;
    pitchViewHeading: string;
    listViewHeading: string;
    slotEmptyLabel: string;
    legacyRuleBadge: string;
    alternativeCandidateCountTemplate: string;
    playerDetailToggleAriaTemplate: string;
    closePanelAriaTemplate: string;
  };
  footer: {
    ariaLandmark: string;
    aboutLink: string;
    termsLink: string;
    privacyLink: string;
    disclaimerLink: string;
    dataManagementLink: string;
    supportLink: string;
    releaseReadinessLink: string;
    unofficialNotice: string;
    draftBadge: string;
  };
  about: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    ruleBasedNotice: string;
    externalAiNotice: string;
    scopeNotice: string;
    availableHeading: string;
    availablePlayerBrowsing: string;
    availableProgressionCalc: string;
    availableMyTeam: string;
    availableSavedBuilds: string;
    availableBuildAnalysis: string;
    availablePresets: string;
    availableNormalHarshMode: string;
    availableCardCompare: string;
    availableDiagnosisCard: string;
    availablePngExport: string;
    availableSavedSquads: string;
    availableSquadDiagnosis: string;
    availableBestXi: string;
    availableJsonBackup: string;
    betaHeading: string;
    betaBestXiIntro: string;
    betaBestXiDedupLimit: string;
    betaBestXiSubPositionLimit: string;
    betaBestXiPoolScopeLimit: string;
    notProvidedHeading: string;
    notProvidedAccount: string;
    notProvidedSync: string;
    notProvidedCloudBackup: string;
    notProvidedFriends: string;
    notProvidedRanking: string;
    notProvidedBilling: string;
    notProvidedPro: string;
    notProvidedNativeApp: string;
    notProvidedVoiceChat: string;
    notProvidedGenerativeAi: string;
    notOfficialNotice: string;
    winRateNotice: string;
    draftNotice: string;
  };
  disclaimer: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    unofficialHeading: string;
    unofficialBody: string;
    unofficialBody2: string;
    rightsHeading: string;
    rightsBody: string;
    rightsBody2: string;
    rightsContactPointer: string;
    analysisHeading: string;
    analysisRuleBased: string;
    analysisNotOfficial: string;
    analysisNoWinGuarantee: string;
    analysisNoUsageGuarantee: string;
    analysisMayBeOutdated: string;
    analysisDataLimits: string;
    analysisUserDecision: string;
    analysisModeNote: string;
    bestXiNote: string;
    bestXiPersonDedup: string;
    bestXiPositionData: string;
    draftNotice: string;
  };
  privacy: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    draftNotice: string;
    dataStoredHeading: string;
    dataStoredFavorites: string;
    dataStoredMyTeam: string;
    dataStoredOwnershipStatus: string;
    dataStoredSavedBuilds: string;
    dataStoredAllocation: string;
    dataStoredBuildIntent: string;
    dataStoredSavedSquads: string;
    dataStoredJsonImportContent: string;
    dataStoredUiSettings: string;
    dataNotStoredHeading: string;
    dataNotStoredName: string;
    dataNotStoredEmail: string;
    dataNotStoredAddress: string;
    dataNotStoredPhone: string;
    dataNotStoredPayment: string;
    dataNotStoredPassword: string;
    dataNotStoredAccount: string;
    dataNotStoredAiConversation: string;
    dataNotStoredFreeformOldInput: string;
    dataNotStoredDiagnosisPng: string;
    dataNotStoredBestXiResults: string;
    storageLocationHeading: string;
    storageLocationBrowserOnly: string;
    storageLocationNoServerAccount: string;
    storageLocationNoSync: string;
    storageLocationNoAutoMigration: string;
    storageLocationNoCloudBackup: string;
    storageLocationDeletionRisk: string;
    externalTransmissionHeading: string;
    externalTransmissionInAppApiIntro: string;
    externalTransmissionInAppApiWorldData: string;
    externalTransmissionInAppApiImageProxy: string;
    externalTransmissionBrowserOnlyIntro: string;
    externalTransmissionNoThirdParty: string;
    externalTransmissionNoGenerativeAi: string;
    externalTransmissionNoAnalytics: string;
    externalTransmissionNoAds: string;
    cookieHeading: string;
    cookieBody: string;
    futureChangesHeading: string;
    futureChangesBody: string;
    specialistReviewNotice: string;
  };
  terms: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    draftNotice: string;
    section1Heading: string;
    section1Body: string;
    section2Heading: string;
    section2Body: string;
    section3Heading: string;
    section3Body: string;
    section4Heading: string;
    section4Intro: string;
    section4ProhibitUnauthorizedAccess: string;
    section4ProhibitVulnerabilityAbuse: string;
    section4ProhibitDataTheft: string;
    section4ProhibitRightsInfringement: string;
    section4ProhibitExcessiveLoad: string;
    section4ProhibitMaliciousJsonOrScript: string;
    section4ProhibitMisrepresentAsOfficial: string;
    section4ProhibitUnlawfulUse: string;
    section5Heading: string;
    section5Body: string;
    section6Heading: string;
    section6Body: string;
    section7Heading: string;
    section7Body: string;
    section8Heading: string;
    section8Body: string;
    section9Heading: string;
    section9Body: string;
    section10Heading: string;
    section10Body: string;
    section11Heading: string;
    section11Body: string;
    section12Heading: string;
    section12Body: string;
    section13Heading: string;
    section13Body: string;
    ownerConfirmationNotice: string;
  };
  dataManagement: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    draftNotice: string;
    storedDataHeading: string;
    storedDataBody: string;
    browserRiskHeading: string;
    browserRiskBody: string;
    browserRiskSameDeviceDifferentBrowser: string;
    browserRiskPrivateMode: string;
    browserRiskBrowserSettings: string;
    noSyncNoCloudBody: string;
    jsonBackupHeading: string;
    jsonBackupBody: string;
    jsonBackupWhereBody: string;
    jsonBackupTimingRecommendation: string;
    jsonBackupContentWarning: string;
    jsonBackupSharingWarning: string;
    jsonBackupImportWarning: string;
    howToDeleteHeading: string;
    howToDeleteBuild: string;
    howToDeleteMyTeam: string;
    howToDeleteSquad: string;
    howToDeleteIntentOnly: string;
    deleteAllHeading: string;
    deleteAllIntro: string;
    deleteAllTargetHeading: string;
    deleteAllTargetFavorites: string;
    deleteAllTargetMyTeam: string;
    deleteAllTargetBuilds: string;
    deleteAllTargetSquads: string;
    deleteAllTargetTemplates: string;
    deleteAllTargetEditorPrefs: string;
    deleteAllTargetComparisonState: string;
    deleteAllExcludedNote: string;
    deleteAllNothingToDelete: string;
    deleteAllStartButton: string;
    deleteAllConfirmTitle: string;
    deleteAllConfirmBody: string;
    deleteAllConfirmButton: string;
    deleteAllCancelButton: string;
    deleteAllBackupReminder: string;
    deleteAllInProgress: string;
    deleteAllSuccessMessage: string;
    deleteAllFailureMessage: string;
    deleteAllPartialFailureMessage: string;
    deleteAllStorageUnavailable: string;
  };
  support: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    draftNotice: string;
    notConfiguredNotice: string;
    sharedChannelIntro: string;
    sharedChannelEmailLabel: string;
    sendMailButtonLabel: string;
    mailtoAriaGeneral: string;
    mailtoAriaBugReport: string;
    mailtoAriaRights: string;
    mailtoAriaPrivacy: string;
    mailtoSubjectGeneral: string;
    mailtoSubjectBugReport: string;
    mailtoSubjectRights: string;
    mailtoSubjectPrivacy: string;
    safetyNoticeHeading: string;
    safetyNoPassword: string;
    safetyNoAuthCode: string;
    safetyNoRecoveryCode: string;
    safetyNoPaymentInfo: string;
    safetyNoUnnecessaryPersonalInfo: string;
    generalContactHeading: string;
    generalContactIntro: string;
    generalContactUnset: string;
    generalContactEmailLabel: string;
    bugReportHeading: string;
    bugReportIntro: string;
    bugReportFieldPage: string;
    bugReportFieldSteps: string;
    bugReportFieldExpected: string;
    bugReportFieldActual: string;
    bugReportFieldBrowser: string;
    bugReportFieldWidth: string;
    bugReportFieldErrorMessage: string;
    bugReportNoPersonalData: string;
    bugReportNoUnsolicitedJsonAttachment: string;
    bugReportCheckScreenshot: string;
    issueTrackerLabel: string;
    rightsHolderHeading: string;
    rightsHolderIntro: string;
    rightsHolderContactIntro: string;
    rightsHolderFieldContent: string;
    rightsHolderFieldUrl: string;
    rightsHolderFieldRightType: string;
    rightsHolderFieldContactInfo: string;
    rightsHolderFieldRequestedAction: string;
    rightsHolderFieldEvidence: string;
    rightsHolderFieldReplyTo: string;
    rightsHolderUnsetNotice: string;
    rightsHolderEmailLabel: string;
    privacyContactHeading: string;
    privacyContactIntro: string;
    privacyContactUnsetNotice: string;
    privacyContactEmailLabel: string;
    noSubmissionFormNotice: string;
  };
  releaseReadiness: {
    pageTitle: string;
    pageDescriptionMeta: string;
    heading: string;
    intro: string;
    currentStageHeading: string;
    currentStageBody: string;
    availableHeading: string;
    betaHeading: string;
    notProvidedHeading: string;
    dataCautionHeading: string;
    dataCautionBody: string;
    knownLimitationsHeading: string;
    limitationBestXiDedup: string;
    limitationSubPosition: string;
    limitationRuleBasedNotOfficial: string;
    noGenerativeAiNotice: string;
    notOfficialNotice: string;
    contactStatusHeading: string;
    contactStatusUnset: string;
    checklistHeading: string;
    checklistIntro: string;
    statusComplete: string;
    statusPartial: string;
    statusNotStarted: string;
    statusNotApplicable: string;
    statusRequiresOwnerAction: string;
    statusRequiresSpecialistReview: string;
    blockingLocalOnly: string;
    blockingInternalTestBlocker: string;
    blockingInviteBetaBlocker: string;
    blockingPublicBetaBlocker: string;
    blockingProductionBlocker: string;
    blockingPaidPlanBlocker: string;
    itemAuthTitle: string;
    itemAuthDesc: string;
    itemDataIsolationTitle: string;
    itemDataIsolationDesc: string;
    itemSyncTitle: string;
    itemSyncDesc: string;
    itemCloudBackupTitle: string;
    itemCloudBackupDesc: string;
    itemLocalBackupTitle: string;
    itemLocalBackupDesc: string;
    itemDataDeletionTitle: string;
    itemDataDeletionDesc: string;
    itemTermsTitle: string;
    itemTermsDesc: string;
    itemPrivacyTitle: string;
    itemPrivacyDesc: string;
    itemDisclaimerTitle: string;
    itemDisclaimerDesc: string;
    itemUnofficialNoticeTitle: string;
    itemUnofficialNoticeDesc: string;
    itemRightsCheckTitle: string;
    itemRightsCheckDesc: string;
    itemSupportContactTitle: string;
    itemSupportContactDesc: string;
    itemRightsContactTitle: string;
    itemRightsContactDesc: string;
    itemHostingTitle: string;
    itemHostingDesc: string;
    itemMonitoringTitle: string;
    itemMonitoringDesc: string;
    itemErrorCollectionTitle: string;
    itemErrorCollectionDesc: string;
    itemSecurityTitle: string;
    itemSecurityDesc: string;
    itemOperatingCostTitle: string;
    itemOperatingCostDesc: string;
    itemFreeProDesignTitle: string;
    itemFreeProDesignDesc: string;
    itemBillingTitle: string;
    itemBillingDesc: string;
    itemCancellationTitle: string;
    itemCancellationDesc: string;
    itemSupportStructureTitle: string;
    itemSupportStructureDesc: string;
    draftNotice: string;
  };
  auth: {
    navSignIn: string;
    navSignUp: string;
    navAccount: string;
    emailLabel: string;
    passwordLabel: string;
    passwordConfirmLabel: string;
    passwordRequirementsHint: string;
    passwordMismatchError: string;
    invalidEmailError: string;
    genericErrorMessage: string;
    tryAgainMessage: string;
    processingAuthMessage: string;
    checkingSessionMessage: string;
    signUpPageTitle: string;
    signUpSubmitButton: string;
    signUpSuccessTitle: string;
    signUpSuccessMessage: string;
    signUpFailedMessage: string;
    signUpHaveAccountPrompt: string;
    signUpSignInLink: string;
    signInPageTitle: string;
    signInSubmitButton: string;
    signInFailedMessage: string;
    signInNoAccountPrompt: string;
    signInSignUpLink: string;
    signInForgotPasswordLink: string;
    logoutButton: string;
    logoutProcessingMessage: string;
    forgotPasswordPageTitle: string;
    forgotPasswordDescription: string;
    forgotPasswordSubmitButton: string;
    forgotPasswordSentMessage: string;
    updatePasswordPageTitle: string;
    updatePasswordDescription: string;
    updatePasswordSubmitButton: string;
    updatePasswordSuccessMessage: string;
    callbackProcessingMessage: string;
    callbackFailedMessage: string;
    callbackReturnLink: string;
    accountPageTitle: string;
    accountLoginRequiredMessage: string;
    accountLoggedInLabel: string;
    accountEmailLabel: string;
    accountCloudSyncNoticeTitle: string;
    accountCloudSyncNoticeDesc: string;
    accountLocalDataNoticeDesc: string;
    accountNoAutoUploadNoticeDesc: string;
    accountCrossDeviceNoticeDesc: string;
    accountDeletionFutureNoticeDesc: string;
    signUpNextStepsHeading: string;
    signUpStep1: string;
    signUpStep2: string;
    signUpStep3: string;
    signUpStep4: string;
    signUpGoToSignInButton: string;
    signUpSpamFolderNotice: string;
    signUpAlreadyConfirmedNotice: string;
    signUpEmailNotArrivingNotice: string;
    localDevConfirmationNotice: string;
    resendConfirmationButton: string;
    resendConfirmationSending: string;
    resendConfirmationSuccessMessage: string;
    resendConfirmationRateLimitedMessage: string;
    resendConfirmationFailedMessage: string;
    resendConfirmationWaitTemplate: string;
  };
}

const ja: Dictionary = {
  common: {
    loading: "読み込み中",
    errorTitle: "問題が発生しました",
    errorDescription: "時間をおいて再度お試しください。解決しない場合はページを再読み込みしてください。",
    retry: "再試行",
    back: "戻る",
    home: "ホームへ",
    save: "保存",
    cancel: "キャンセル",
    close: "閉じる",
    confirm: "実行",
    unknownPlayer: "名前不明",
  },
  pageError: {
    title: "ページの表示中にエラーが発生しました",
    description: "データの読み込みに失敗しました。再試行しても直らない場合は、ページを再読み込みしてください。",
    codeLabelPrefix: "コード: ",
    iconAriaLabel: "エラー",
  },
  notFoundPage: {
    title: "ページが見つかりません",
    description: "指定されたページまたは選手は存在しないか、移動された可能性があります。",
    playersLink: "プレイヤー一覧へ",
  },
  homePage: {
    heroBadge: "eFootball データツール",
    heroTitlePrefix: "選手を調べ、比較し、",
    heroTitleAccent: "スカッド",
    heroTitleSuffix: "を組む。",
    heroDescriptionTemplate:
      "eFootball World の全 {count} カードを SQLite で提供。26 能力値・スキル・育成計算・監督補正・Link-Up Play 条件までを一つの画面で。計算規則が未確認の項目は「検証中」と明示します。",
    searchPlaceholder: "選手名・World ID で検索…",
    searchAriaLabel: "選手を検索",
    searchButton: "検索",
    compareButton: "選手比較",
    createSquadButton: "スカッド作成",
    dataStatusHeading: "データの状態",
    worldCardsLabel: "World カード",
    efhubIndexLabel: "eFHUB 索引",
    managersLabel: "監督",
    syncedAtLabel: "取り込み日時",
    worldUnavailableTitle: "World データがまだ用意されていません",
    worldUnavailableCommandPrefix: "ターミナルで ",
    worldUnavailableCommandSuffix: " を実行してください。",
    topOvrHeading: "最大OVRの高いカード",
    recentHeading: "最近更新されたカード",
    viewAllLink: "すべて見る",
    quickLinksHeading: "できること",
    findPlayersLabel: "プレイヤーを探す",
    findPlayersDescTemplate: "{count} 枚の World カードを検索・絞り込み",
    comparePlayersLabel: "選手を比較する",
    comparePlayersDesc: "2〜4 人の能力値・スキル・育成・監督補正を並べる",
    buildSquadLabel: "スカッドを組む",
    buildSquadDesc: "フォーメーション・育成・監督・Link-Up 条件を確認",
    exploreManagersLabel: "監督を調べる",
    exploreManagersDescTemplate: "{count} 人の戦術適性・ブースター・Link-Up Play",
    inDevelopmentHeading: "開発中の機能",
    inDevelopmentHint: "順次追加予定",
    featureTierList: "ティアリスト",
    featurePackDiagnosis: "パック（ガチャ）診断",
    featureAiCoach: "AI コーチ分析",
    featureCommunity: "コミュニティ",
    designDocNote:
      "設計の詳細は docs/efootball-team-ai-design.md を参照。表示は取り込み済みの実データのみで、架空の利用者数・評価は表示しません。",
  },
  managersPage: {
    metaTemplate: "{count} 名の監督",
    descriptionTemplate: "データソース: {source}（GitHub data/managers.json）。age・国籍・チーム・Coaching Affinity・フォーメーションはソース非収録。",
    dataUnavailableTitle: "監督データがまだ用意されていません",
    dataUnavailableDescription: "ターミナルで `node scripts/sync-managers.mjs` を実行して SQLite に取り込んでください。",
    failedTitle: "監督データを読み込めませんでした",
    failedDescription: "時間をおいて再読み込みしてください。",
    noResultsTitle: "条件に一致する監督がいません",
    noResultsDescription: "検索語やフィルターを変えてみてください。",
    clearFiltersLink: "条件を解除",
    showingCountTemplate: "{total} 名中 {from}〜{to} 名を表示",
    prevPageLink: "前へ",
    nextPageLink: "次へ",
    pageOfTemplate: "{page} / {totalPages}",
    paginationAriaLabel: "ページ送り",
  },
  nav: {
    groupMain: "メイン",
    groupMyData: "マイデータ",
    groupAnalysis: "分析",
    groupCommunity: "コミュニティ",
    home: "ホーム",
    players: "プレイヤー",
    managers: "マネージャー",
    compare: "選手比較",
    squads: "スカッド",
    favorites: "お気に入り",
    myTeam: "My Team",
    myBuilds: "My Builds",
    buildInventory: "ビルド分析",
    bestXi: "AIベスト11",
    tierLists: "ティアリスト",
    packs: "パック",
    community: "コミュニティ",
    comingSoon: "準備中",
    ariaSidebar: "サイドメニュー",
    ariaCollapse: "サイドバーを折りたたむ",
    ariaExpand: "サイドバーを開く",
    collapseLabel: "折りたたむ",
    ariaMobileMenuOpen: "メニューを開く",
    ariaMobileMenuClose: "メニューを閉じる",
    ariaMobileMenu: "メニュー",
    ariaHome: "ホーム",
    brand: "eFootball Team AI",
  },
  header: {
    searchPlaceholder: "選手を検索…",
    searchAriaLabel: "選手を検索",
    ariaHomeLink: "eFootball Team AI ホーム",
  },
  language: {
    japanese: "日本語",
    english: "English",
    ariaLabel: "表示言語を選択",
  },
  diagnosis: {
    heading: "スカッド診断（スカッド構成評価）",
    unavailableTitle: "スカッド診断",
    unavailableMessage: "スカッド情報を読み込めなかったため診断できません。",
    mainDisclaimer:
      "この評価は、登録された選手能力・育成・配置にもとづくスカッド構成評価です。試合結果やプレイヤースキル、全国順位・勝率を保証するものではありません。",
    overallScore: "総合評価",
    tierBadgePrefix: "評価",
    notRated: "判定対象外",
    ratedItems: "判定可能項目",
    placementCoverage: "配置充足率",
    savedBuildMissingStat: "保存ビルド未設定",
    savedBuildMissingUnitSuffix: "人（先発）",
    coverageMetricsNote:
      "「判定可能項目」「配置充足率」は選手配置とカードの解決状況のみを表し、保存ビルドの設定状況とは別の指標です。育成やブースターを反映した保存ビルドが未設定の選手がいても、これらの値は変化しません。",
    commentModeNormal: "通常",
    commentModeHarsh: "辛口",
    commentModeDisplayingSuffix: "（表示中）",
    commentModeHarshBadge: "辛口モード",
    improvementPrioritiesHeading: "改善優先順位（最大3件・提案のみ・自動適用しません）",
    keepStrengthPrefix: "維持すべき長所",
    commentSectionHeading: "コメント",
    categoriesHeadingSuffix: "項目",
    detailsToggle: "項目別の詳細な根拠を見る",
    evidenceToggle: "根拠を見る",
    strengthsHeading: "最大の長所（最大3件）",
    strengthsEmpty: "明確な長所は検出されませんでした。",
    weaknessesHeading: "最大の弱点（最大3件）",
    weaknessesEmpty: "明確な弱点は検出されませんでした。",
    suggestionsHeading: "改善候補（最大3件・提案のみ・自動適用しません）",
    criticalWarningsHeading: "確認が必要な項目",
    findingBadgeReferenceError: "参照エラー",
    findingBadgeCompatibility: "配置適性",
    findingBadgeConfig: "データ不足・設定",
    pngSaveButton: "診断結果を画像で保存",
    pngSaveButtonAriaLabel: "スカッド診断の結果をPNG画像として保存",
    pngSaveGenerating: "画像を生成中…",
    pngSaveSuccess: "画像を保存しました。",
    pngSaveError: "画像の保存に失敗しました。時間をおいて再度お試しください。",
    dataQualityStarters: "先発配置",
    dataQualityBench: "ベンチ人数",
    dataQualityMissingBuild: "保存ビルド未設定",
    dataQualityBrokenRef: "保存ビルド参照エラー",
    dataQualityUnresolvedCard: "未解決カード",
    dataQualityManagerUnresolved: "監督未解決",
    dataQualityYes: "あり",
    dataQualityNo: "なし",
    unratedCategoriesPrefix: "評価不能項目",
    footerNote:
      "この診断は読み取り専用です。スカッド・保存ビルド・My Team・カードお気に入りは変更しません。表示のたびに現在の保存内容から再計算します（自動保存はしません）。",
  },
  category: {
    attack: "攻撃",
    defense: "守備",
    aerial: "空中戦",
    speed: "スピード",
    passBuildUp: "パス・ビルドアップ",
    dribblePossession: "ドリブル・ボール保持",
    pressResistance: "プレス適性",
    counterAttack: "カウンター適性",
    squadCompleteness: "選手配置の充足状況",
  },
  tactical: {
    sectionHeading: "配置構造・戦術監査",
    scopeDescription:
      "現在の配置ポジション、フォーメーション座標、確認済み診断カテゴリにもとづく構造分析です。プレースタイルの発動可否、選手固有AI、実際の試合中の挙動は判定していません。",
    placementCountLabel: "配置",
    placementCountUnit: "人",
    severityHigh: "重要度: 高",
    severityMedium: "重要度: 中",
    severityLow: "重要度: 低",
    severityInfo: "参考情報",
    confidenceHigh: "信頼度: 高",
    confidenceMedium: "信頼度: 中",
    confidenceLow: "信頼度: 低",
    confidenceInsufficient: "信頼度: データ不足",
    coverageInsufficient: "配置不足",
    coverageLimited: "配置一部のみ",
    coveragePartial: "配置ほぼ完了",
    coverageFull: "配置完了",
    potentialRiskPrefix: "想定されるリスク",
    limitationsPrefix: "分析上の制限",
  },
  managerPicker: {
    sortName: "名前順",
    sortReleasedDesc: "リリースが新しい順",
    sortReleasedAsc: "リリースが古い順",
    sortPossessionDesc: "ポゼッション適性 高い順",
    sortQuickCounterDesc: "ショートカウンター適性 高い順",
    sortLongBallCounterDesc: "ロングカウンター適性 高い順",
    sortOutWideDesc: "サイドアタック適性 高い順",
    sortLongBallDesc: "ロングボール適性 高い順",
    sortOverloadDesc: "オーバーロード適性 高い順",
    defaultTitle: "監督を選択",
    currentPrefix: "現在: ",
    currentIdPrefix: "ID ",
    currentNone: "監督なし",
    setNoManager: "監督なしにする",
    searchLabel: "検索（一覧の絞り込み）",
    searchPlaceholder: "監督名・チーム",
    tacticFilterAria: "得意戦術で絞り込み",
    tacticFilterAll: "得意戦術: 全て",
    boosterFilterAria: "ブースターで絞り込み",
    boosterFilterAll: "ブースター: 全て",
    boosterFilterHas: "ブースターあり",
    boosterFilterNone: "ブースターなし",
    linkUpFilterAria: "Link-Up Play で絞り込み",
    linkUpFilterAll: "Link-Up: 全て",
    linkUpFilterHas: "Link-Up あり",
    linkUpFilterNone: "Link-Up なし",
    yearFilterAria: "リリース年で絞り込み",
    yearFilterAll: "リリース年: 全て",
    yearSuffix: " 年",
    sortAria: "並べ替え",
    loadError: "監督一覧を読み込めませんでした。",
    detailError: "監督詳細を取得できませんでした。",
    chooseError: "監督を選択できませんでした。",
    noResultsTitle: "条件に一致する監督がいません",
    noResultsDescription: "検索語やフィルターを変えてみてください。",
    countSuffix: " 名",
    selectedBadge: "選択中",
    releasedPrefix: "リリース ",
    unknownReleased: "不明",
    noBoosterBadge: "ブースターなし",
    viewDetail: "詳細を見る",
    chooseThis: "この監督を選択",
    backToList: "一覧へ戻る",
    idPrefix: "ID ",
    bestTacticPrefix: "得意戦術: ",
    proficienciesHeading: "戦術適性",
    boostersHeading: "監督ブースター",
    noBoosterMessage: "この監督に能力値ブースターはありません。",
    boosterApplicationNote: "確認済みブースターのみ能力値へ適用します。適用順序（育成前 / 後）は未確認です。",
    linkUpHeading: "Link-Up Play",
    centerPiecePrefix: "Center Piece: ",
    keyManPrefix: "Key Man: ",
    linkUpNote: "発動条件の照合のみ。ゲーム内効果は追加検証中です。",
    chooseThisSelected: "この監督を選択中（そのまま閉じる）",
  },
  managerCard: {
    bestTacticLabel: "得意戦術",
  },
  managerControls: {
    sortNameLabel: "名前順",
    sortReleasedDesc: "リリースが新しい順",
    sortReleasedAsc: "リリースが古い順",
    sortPossessionDesc: "ポゼッション適性 高い順",
    sortQuickCounterDesc: "クイックカウンター適性 高い順",
    searchPlaceholder: "監督名・チームで検索",
    searchAriaLabel: "監督を検索",
    sortAriaLabel: "並べ替え",
    boosterFilterAriaLabel: "ブースター",
    boosterFilterAllOption: "ブースター: 全て",
    boosterFilterHasOption: "ブースターあり",
    boosterFilterNoneOption: "ブースターなし",
    linkUpFilterAriaLabel: "Link-Up Play",
    linkUpFilterAllOption: "Link-Up Play: 全て",
    linkUpFilterHasOption: "Link-Up Play あり",
    linkUpFilterNoneOption: "Link-Up Play なし",
  },
  manager: {
    squadWideHeading: "監督（スカッド全体）",
    confirmedBoostersAppliedPrefix: "確認済みブースターを ",
    confirmedBoostersAppliedSuffix: " 人へ適用中",
    selectManagerTitle: "スカッドの監督を選択",
    none: "監督なし（managerBoosterDelta = 0）",
    noneDescription: "監督を選ぶと、確認済みブースターが対象能力へ適用されます。",
    selectFromList: "監督一覧から選択",
    change: "変更",
    clear: "解除",
    confirmedBoosterActive: "確認済みブースターを適用中",
    unconfirmedBoosterNotice: "この監督のブースター効果は未確認のため適用していません（表示のみ）。",
    linkUpPlayAvailable: "Link-Up Play あり（照合のみ・効果は検証中）",
    applicationOrderUnconfirmed: "適用順序（育成前 / 育成後）は未確認です。",
    viewManagerDetail: "監督詳細を見る",
    bestAt: "得意",
  },
  compareCategory: {
    attack: "攻撃",
    dribble: "ドリブル",
    pass: "パス",
    defense: "守備",
    physical: "フィジカル",
    speed: "スピード",
    gk: "GK",
  },
  teamSummary: {
    heading: "チームサマリー",
    calcNote:
      "平均・合計は単純計算です。eFootball の公式チームパワー・カテゴリ重みとは異なります（暫定・非公式）。",
    boosterModeNote:
      "ブースター適用モード: 標準。カード付属の効果を外部2ソースで照合したブースターと監督補正のみ集計に反映（KONAMI 公式未確認）。発動方式が固定型と推定のもの（Power of Many である具体的証拠がないため暫定適用）を含みます。金色の可変ブースター（Game Plan の同一リーグ人数で効果量が変化・現状のスカッドでは自動評価不可）のユーザー指定値・効果検証中・未解決の付属ブースターと手動試算は含めません。",
    startingBenchLabel: "先発 / ベンチ",
    avgBaseOvrLabel: "平均 基礎OVR",
    avgDisplayedOvrLabel: "平均 表示OVR（検証中）",
    sharedSkillCountLabel: "共通スキル数",
    managerBoostedLabel: "監督ブースター適用",
    unresolvedCompatibilityLabel: "適性未確認",
    possibleMismatchLabel: "不適性の可能性",
    warningsLabel: "警告",
    peopleSuffix: " 人",
    countSuffix: " 件",
    positionBreakdownHeading: "ポジション構成",
    categoryAveragesHeading: "カテゴリ平均（単純平均・非公式）",
    sharedSkillsHeading: "先発全員が持つスキル",
    conditionalToggleLabel: "条件付き試算サマリー（手動指定による試算）",
    conditionalNote:
      "一部の選手に金色・可変ブースターの適用段階がユーザー手動指定されています。この試算はユーザーが自身の Game Plan を確認して指定した段階に基づくもので、アプリが編成人数を自動検証した値ではありません。通常のチームサマリー（上）には含めていません。",
    conditionalAvgDisplayedOvrLabel: "平均 表示OVR（条件反映後・試算）",
    conditionalCategoryLabelSuffix: "（条件反映後）",
    conditionalValueTemplate: "{value}（標準 {std}）",
  },
  buildUsage: {
    heading: "ビルド使用状況",
    viewDetail: "詳細を見る",
    setCountLabel: "設定済み",
    unsetCountLabel: "未設定",
    missingCountLabel: "削除済み参照",
    peopleSuffix: " 人",
    footerTemplate: "先発 {starter} / ベンチ {bench}。スカッド用ビルドは My Team の選択中／お気に入りビルドとは別です。",
    modalTitle: "ビルド使用状況（このスカッド）",
    modalIntro:
      "現在のスカッドの各枠のスカッド用保存ビルド（savedBuildId）の状況です。ここでは確認と各枠の「保存ビルドを選ぶ」への移動だけを行います。一括適用・一括解除・自動補完はしません。表示しただけではスカッドは保存されません。",
    statTotal: "総登録人数",
    statStarter: "先発",
    statBench: "ベンチ",
    statSet: "ビルド設定済み",
    statUnset: "未設定",
    statMissing: "削除済み参照",
    statCurrentRules: "現行規則ビルド",
    statLegacyRules: "旧規則ビルド",
    statUnknownRules: "規則不明ビルド",
    statPom: "Power of Many 指定あり",
    statExperimental: "実験的試算あり",
    filterAll: "全員",
    filterSet: "設定済み",
    filterUnset: "未設定",
    filterMissing: "削除済み参照",
    filterStarter: "先発",
    filterBench: "ベンチ",
    searchPlaceholder: "選手名・ビルド名で検索",
    searchAriaLabel: "ビルド使用状況を検索",
    emptyList: "条件に一致する枠がありません。",
    areaStarter: "先発",
    areaBench: "ベンチ",
    buildUnset: "スカッド用ビルド: 未設定",
    buildMissingTemplate: "スカッド用ビルド: 見つかりません（削除済み・buildId {id}）",
    buildSetPrefix: "スカッド用ビルド: ",
    pomSuffix: "・Power of Many 指定あり",
    experimentalSuffix: "・実験的試算あり",
    chooseBuildButton: "保存ビルドを選ぶ",
    manageInMyBuilds: "My Builds で管理",
    closeButton: "閉じる",
    ruleCurrentLabel: "現行規則",
    ruleLegacyLabel: "旧規則",
    ruleUnknownLabel: "規則不明",
  },
  linkUp: {
    notice: "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。",
    noManagerNote: "監督を選択すると Link-Up Play の条件を照合します。",
    noDataNote: "この監督に Link-Up Play のデータはありません。",
    statusMet: "条件達成",
    statusPartial: "一部達成",
    statusUnmet: "未達成",
    statusIndeterminate: "判定不能",
    noStyleSpecified: "（プレースタイル指定なし）",
    noConditionData: "条件データなし",
    matchingStartersLabel: "合致する先発: ",
    noneLabel: "なし",
    selectAriaTemplate: "{name} の {role} を選択",
    noManualSelection: "（手動選択なし）",
    selectedPrefix: "選択中: ",
    satisfiesYes: "条件を満たします",
    satisfiesNo: "条件を満たしません",
  },
  squadBuildPanel: {
    modalTitle: "保存ビルドを選択（スカッド）",
    intro:
      "このスカッド枠で使用する保存ビルド（スカッド用ビルド）を確認・変更します。My Team の選択中ビルド・お気に入りビルドとは別の設定です。対象枠の設定だけを変更し、他の枠・配置・座標・キャプテン・セットプレー・監督・他のスカッドは変更しません。",
    targetHeading: "対象",
    targetSquadLabel: "スカッド: ",
    targetSlotLabel: "枠: ",
    cardDetailAriaTemplate: "{name} の選手詳細",
    cardImageAltTemplate: "{name} のカード画像",
    cardImageAltGeneric: "カード画像",
    cardTypeUnknown: "カードタイプ不明",
    registeredPositionUnknown: "登録ポジション不明",
    currentBuildLabel: "現在のスカッド用ビルド: ",
    noneLabel: "なし",
    missingBuildTemplate: "見つかりません（削除済み・buildId {id}）",
    buildIdSuffixTemplate: "（buildId {id}）",
    clearSelectionButton: "スカッドでの選択を解除",
    savedBuildCountTemplate: "保存ビルド {count} 件",
    storageUnavailable: "このブラウザでは保存できません（localStorage 不可）。設定・解除はできません。",
    staleNotice: "別のタブでスカッドまたは保存ビルドが更新されました。",
    reloadButton: "再読込",
    confirmDialogAria: "変更の確認",
    confirmClearTextTemplate:
      "{area}「{slot}」（{name}・World ID {worldCardId}）のスカッド用保存ビルド選択を解除します（savedBuildId を未設定に戻します）。",
    clearChangedItemsLabel: "変更される項目: この枠の savedBuildId とスカッドの更新日時のみ",
    clearUnchangedItemsLabel:
      "変更されない項目: 他の枠・選手カード・配置・座標・キャプテン・セットプレー・監督・スカッド名・テンプレート・他のスカッド・My Team の選択中／お気に入りビルド・カード自体のお気に入り・比較状態",
    confirmSetIntro: "このスカッド枠で使用する保存ビルドを変更します。",
    currentPrefixLabel: "現在: ",
    deletedTemplate: "削除済み（buildId {id}）",
    afterChangeLabel: "変更後: ",
    ruleVersionTemplate: "rulesVersion {version}（{label}）",
    allocationLabel: "・ 配分: ",
    noAllocation: "配分なし",
    pomLabel: "・ Power of Many: ",
    pomUnspecified: "未指定",
    setChangedItemsLabel: "変更される項目: この枠の savedBuildId とスカッドの更新日時のみ",
    setUnchangedItemsLabel:
      "変更されない項目: 他の枠・選手カード・配置・座標・キャプテン・セットプレー・監督・他のスカッド・My Team の選択中／お気に入りビルド・保存ビルド本体・カード自体のお気に入り",
    setFooterNote: "My Team の選択中ビルドとお気に入りビルドは変更されません。",
    confirmSetButton: "変更する",
    confirmClearButton: "解除する",
    cancelButton: "キャンセル",
    emptyBuildsHeading: "保存ビルドがありません",
    emptyBuildsBody: "このカードの選手詳細または選手比較で育成を調整し、「この育成を保存」から追加できます。",
    playerDetailLink: "選手詳細",
    progressionTabLink: "育成タブ",
    myBuildsLink: "My Builds",
    searchLabel: "保存ビルドを検索（ビルド名・buildId）",
    searchPlaceholder: "決定力型 / b_xxxx",
    searchAriaLabel: "保存ビルドを検索",
    noSearchResults: "条件に一致する保存ビルドがありません。",
    manageInMyBuilds: "My Builds で管理",
    createBuildInProgression: "育成でビルドを作成",
    closeButton: "閉じる",
    footerNote:
      "ここでは対象枠のスカッド用保存ビルドの設定・解除だけを行います。既存の「保存ビルドを適用...」セレクトも引き続き使えます。名前変更・複製・削除・新規登録は My Builds / 選手詳細で行います。",
    alreadyUsingNotice: "この枠は既にこの保存ビルドを使用しています。",
    setSuccessTemplate:
      "{area}「{slot}」でスカッドが使用する保存ビルドを「{buildName}」に設定しました。 My Team の選択中ビルド・お気に入りビルドは変更していません。",
    alreadyUnsetNotice: "この枠のスカッド用保存ビルドは未設定です。",
    clearSuccessTemplate:
      "{area}「{slot}」のスカッド用保存ビルド選択を解除しました。 選手カード・配置・座標・My Team・カード自体のお気に入りは変更していません。",
    errorStorage: "このブラウザでは保存できません（localStorage 不可）",
    errorCardId: "カード ID が不正です",
    errorSlotMissing: "対象の枠が見つかりません（別のタブで変更された可能性があります）。再読込してください。",
    errorCardMismatch: "枠のカードが別のタブで変更されています。パネルを開き直してください。",
    errorBuildId: "ビルド ID が不正です",
    errorBuildMissing: "対象の保存ビルドが見つかりません（削除された可能性があります）。再読込してください。",
    inUseBadge: "この枠で使用中",
    allocationRowLabel: "育成配分: ",
    noAllocationBase: "配分なし（基礎能力値のまま）",
    allAllocationSummary: "全配分（10カテゴリ）",
    pointsUsedNoTotalTemplate: "使用 {used} pt / 合計 —",
    pointsUsedTotalTemplate: "使用 {used} / 合計 {total} pt",
    remainingUnknown: "残り —",
    remainingTemplate: "残り {remaining} pt",
    overAllocated: "配分超過",
    pomRowLabel: "Power of Many（ユーザー指定）: ",
    experimentalLabel: " / 実験的試算: ",
    yes: "あり",
    no: "なし",
    estimatedOvrLabel: "保存時の推定OVR: ",
    calcModeConfirmed: "基礎値のみ",
    calcModeUnsupported: "計算不可",
    calcModeProvisional: "暫定規則",
    totalOvrPlaceholder: "総合値（ポジション別 OVR）: —（計算規則を確認中）",
    createdUpdatedTemplate: "作成 {created} / 更新 {updated}",
    useThisBuild: "このビルドをスカッドで使用",
    cardFallbackNameTemplate: "カード {id}",
  },
  squadEditor: {
    assignErrorInvalidCard: "カード ID が不正です。",
    assignErrorInvalidSlot: "配置先スロットが不正です。",
    assignErrorSlotNotFound: "配置先スロットが見つかりません。",
    assignErrorDuplicate: "同じカードはこのスカッドに既にいます（同一人物の別カードは追加できます）。",
    assignErrorSlotOccupied: "この枠にはすでに選手がいます。先に外してください。",
    assignErrorBenchFullTemplate: "ベンチは最大 {max} 人です。",
    moveErrorInvalidSquad: "スカッドの状態が不正です。",
    moveErrorInvalidSource: "移動元が不正です。",
    moveErrorInvalidTarget: "移動先が不正です。",
    moveErrorSourceEmpty: "移動元に選手がいません。",
    moveErrorTargetNotFound: "移動先が見つかりません。",
    managerFetchFailed: "監督の取得に失敗しました。",
    storageUnavailableShort: "この環境ではスカッドを保存できません（localStorage 不可）。",
    slotNotFoundReopen: "対象の枠が見つかりません。パネルを開き直してください。",
    slotCardChangedReopen: "枠のカードが変わりました。パネルを開き直してください。",
    buildNotFoundDeleted: "対象の保存ビルドが見つかりません（削除された可能性があります）。",
    reloadedFromStorage: "スカッドを最新の保存内容に更新しました。",
    undoLabelMovedSnap: "選手の位置を変更（スナップ）",
    undoLabelMoved: "選手の位置を変更しました",
    snapTypeHorizontal: "同ライン",
    snapTypeCenter: "中央",
    snapTypeSymmetry: "左右対称",
    placementRoleToastPrefix: "配置ロール: ",
    placementRoleManualSuffix: "（手動指定）",
    roleManualOverrideTemplate: "配置ロールを {role} に手動指定",
    roleAutoRestored: "配置ロールを自動判定に戻しました",
    undoLabelResetToFormation: "フォーメーション初期位置へ戻しました",
    freePositionReset: "選手の自由配置を初期位置へ戻しました。",
    mirrorApplied: "先発配置を左右反転しました。",
    undoDoneTemplate: "元に戻しました（{label}）",
    movedToBenchTemplate: "{count} 人をベンチへ移動しました。",
    droppedBenchFullTemplate: "ベンチが満杯のため {count} 人を外しました。",
    pendingPlacedNotice: "追加候補の選手をこの枠へ配置しました。",
    templateSavedNotice: "テンプレートとして保存しました。",
    noStorageTitle: "この環境ではスカッドを保存できません",
    noStorageDescription: "ブラウザの localStorage が使用できないため、スカッド機能は利用できません（プライベートモード等）。",
    notFoundTitle: "スカッドが見つかりません",
    notFoundDescription: "指定されたスカッドは存在しないか、削除されています。",
    backToSquadList: "スカッド一覧へ",
    squadNameAriaLabel: "スカッド名",
    savedButtonLabel: "保存しました",
    saveButtonLabel: "保存",
    saveStateSaving: "保存中…",
    saveStateSaved: "保存済み",
    saveStateError: "保存に失敗しました",
    saveStateIdle: "変更は自動保存されます",
    retrySaveButton: "保存を再試行",
    duplicateButton: "複製",
    templateNamePromptLabel: "テンプレート名",
    templateNamePromptSuffix: " テンプレート",
    saveAsTemplateButton: "テンプレ保存",
    templateListLink: "テンプレート一覧",
    compareWithAnotherLink: "別のスカッドと比較",
    compareWithAnotherTitle: "このスカッドを比較対象Aにして別のスカッドと比較（編集内容は変更しません）",
    renamePromptLabel: "新しいスカッド名",
    renameButton: "名前変更",
    resetButton: "リセット",
    rulesOutdatedNotice:
      "このスカッドは旧い規則バージョンで保存されています。現行規則で再計算して表示しています（保存すると現行規則で上書きされます）。",
    loadingPlacedCardsTemplate: "配置した選手のデータを読み込み中…（{count} 件）",
    failedPlacedCardsTemplate: "配置した選手の情報を取得できませんでした（{count} 件）。枠と選手 ID は保持しています。",
    retryWithIdTemplate: "再試行（ID {id}）",
    confirmResetTemplate: "スカッド「{name}」の先発・ベンチ・監督をすべてリセットします。よろしいですか？",
    confirmResetButton: "リセットする",
    cancelActionButton: "やめる",
    mobileTabPitch: "ピッチ",
    mobileTabBench: "ベンチ",
    mobileTabManager: "監督",
    mobileTabSummary: "サマリー",
    mobileTabLinkUp: "Link-Up",
    moveBannerTemplate:
      "{name} を移動中。空き枠を選ぶと移動、選手がいる枠を選ぶと入れ替え、ベンチを選ぶとベンチへ移動します（Esc でキャンセル）。",
    moveBannerFallbackName: "選手",
    moveBannerCancel: "キャンセル",
    undoBannerTemplate: "直前の操作: {label}",
    undoButton: "元に戻す",
    pendingAlreadyPlacedTemplate: "{name} は既にこのスカッドにいます。",
    pendingOkButton: "OK",
    pendingChooseTargetTemplate: "{name} の追加先を選んでください（空いているピッチ枠をタップ、またはベンチへ）。",
    pendingBuildNameTemplate: "使用するビルド: {buildName}",
    pendingAddToBenchButton: "ベンチに追加",
    pendingCancelButton: "やめる",
    pendingBuildNotFoundText: "選択した保存ビルドを確認できません。",
    pendingGoToMyTeamLink: "My Teamへ戻る",
    placementAidLabel: "配置補助:",
    snapToggleTemplate: "スナップ {state}",
    guidesToggleTemplate: "ガイド {state}",
    gridToggleTemplate: "グリッド {state}",
    mirrorPlacementButton: "配置を左右反転",
    resetToFormationButton: "フォーメーション位置に戻す",
    pitchCaptionMain:
      "枠をタップして選手を追加・変更。選手カードはピッチ内の任意位置へドラッグでき、位置に応じて配置ロールが自動判定されます。スナップ ON のときは近くのライン・中央・左右対称位置へ弱く吸着します（Alt を押しながらドラッグで一時無効）。",
    pitchLegendMatch: "一致 / ",
    pitchLegendUnresolved: "適性未確認 / ",
    pitchLegendMismatch: "不適性の可能性",
    confirmMirrorText:
      "先発選手の配置を左右反転します（x → 100−x）。選手・育成ビルド・ブースター設定・キャプテン・セットプレー担当・ベンチは維持されます。",
    confirmMirrorButton: "左右反転する",
    confirmResetPosTemplate:
      "選手の自由配置を現在のフォーメーション（{formationId}）の初期位置へ戻します。選手・ベンチ・育成ビルド・ブースター設定・キャプテン・セットプレー担当は削除されません。",
    confirmResetPosButton: "初期位置へ戻す",
    posAdjustBanner: "位置調整モード: ピッチをタップ、または矢印キー（Shift で大きく）で移動。Enter / もう一度ボタンで確定、Esc で終了。",
    posAdjustEndButton: "終了",
    addPlayerToSlotTitleTemplate: "{position} に選手を追加",
    addPlayerToBenchTitle: "ベンチに選手を追加",
    addToSlotLabelTemplate: "{position} へ追加",
    addToBenchLabel: "ベンチへ追加",
    emptySlotHeadingSuffix: "枠",
    slotCardFetchFailedTemplate: "選手情報を取得できませんでした（カード ID: {id}）。枠と選手 ID は保持しています。",
    retryButton: "再試行",
    removeFromSlotButton: "枠から外す",
    slotCardLoadingTemplate: "選手データを読み込み中…（カード ID: {id}）",
    selectSlotHint: "枠を選択すると、その選手の育成ビルド・適性・監督補正を編集できます。",
    compareHeading: "比較へ（最大4人）",
    compareSelectedCountTemplate: "選択中: {count} 人",
    compareSelectedHint: "（各選手パネルの「比較へ追加」で選択）",
    compareGoLink: "比較画面へ（育成方針・監督を引き継ぎ）",
    compareClearButton: "選択解除",
    roleSettingsHeading: "役割設定",
    captainLabel: "キャプテン",
    roleUnsetOption: "未設定",
    freeKickLabel: "FK 担当",
    cornerLabel: "CK 担当",
    penaltyLabel: "PK 担当",
    roleAutoClearNote: "担当選手が先発から外れると自動で解除されます（別選手へは移しません）。",
    warningsHeadingTemplate: "警告 / 注記（{count}）",
    skeletonLoading: "スカッドを読み込んでいます…",
    starterFallbackLabel: "先発",
    starterSlotFallbackLabel: "先発枠",
    benchAreaFallbackLabel: "ベンチ",
  },
  squadList: {
    pageTitle: "スカッド",
    pageDescriptionTemplate: "先発11人＋ベンチのスカッドを組み、フォーメーション・育成ビルド・監督補正・Link-Up Play 条件を確認します。対応フォーメーション: {formations}。",
    goToCompareLink: "選手比較へ",
    pendingCardBannerBoldTemplate: "My Team のカード「{name}」",
    pendingCardBannerNameLoading: "読み込み中…",
    pendingCardBannerSuffix: "を追加するスカッドを選んでください（各スカッドの「このカードを追加」）。スカッドを開いた後、追加先の空き枠をタップします。",
    pendingCardDetailLink: "この選手の詳細",
    noStorageTitle: "この環境ではスカッドを保存できません",
    noStorageDescription: "ブラウザの localStorage が使用できません（プライベートモード等）。スカッドはこの端末のブラウザ内にのみ保存されます。",
    templateNamePrompt: "テンプレート名",
    templateNamePromptSuffix: " テンプレート",
    defaultNewSquadName: "新しいスカッド",
    createFormHeading: "新しいスカッドを作成",
    squadNameLabel: "スカッド名",
    squadNameAriaLabel: "新しいスカッド名",
    squadNamePlaceholder: "例: メインスカッド（1〜50文字）",
    formationLabel: "フォーメーション",
    createAndEditButton: "作成して編集",
    heroHeading: "先発11人＋ベンチのスカッドを組む",
    heroDescription:
      "フォーメーションを選び、World 13,009 カードから選手を配置。育成ビルド・監督補正・Link-Up Play 条件を一画面で確認できます。計算は既存の育成・監督エンジンを再利用（規則は「検証中」）。スカッドはこの端末のブラウザ内（localStorage）にのみ保存されます。",
    createFirstSquadButton: "最初のスカッドを作成",
    createNewSquadButton: "新しいスカッドを作成",
    goToCompareButton: "選手比較へ",
    savedSquadsHeadingTemplate: "保存済みのスカッド{counts}",
    compareSquadsLink: "スカッドを比較",
    templateListLink: "テンプレート一覧へ",
    searchByNamePlaceholder: "スカッド名で検索",
    searchByNameAriaLabel: "スカッド名で検索",
    searchByPlayerPlaceholder: "使用選手の World ID",
    searchByPlayerAriaLabel: "使用選手の World ID で絞り込み",
    formationFilterAriaLabel: "フォーメーションで絞り込み",
    formationFilterAll: "全フォーメーション",
    customFilterAriaLabel: "カスタム配置で絞り込み",
    customFilterAll: "配置: すべて",
    customFilterYes: "カスタム配置あり",
    customFilterNo: "プリセット配置",
    sortAriaLabel: "並び替え",
    sortUpdatedDesc: "更新が新しい順",
    sortCreatedDesc: "作成が新しい順",
    sortName: "名前順",
    sortFormation: "フォーメーション順",
    loading: "読み込み中…",
    emptyTitle: "保存済みのスカッドはありません",
    emptyDescription: "上のフォームから最初のスカッドを作成してください。",
    noResultsMatchFilter: "条件に一致するスカッドがありません。",
    customPositioningBadge: "カスタム配置",
    startingCountTemplate: "先発 {count}/11",
    benchCountTemplate: "ベンチ {count}",
    hasManagerLabel: "監督あり",
    noManagerLabel: "監督なし",
    updatedAtTemplate: "更新 {date}",
    outdatedRulesBadge: "旧規則で保存",
    addThisCardLink: "このカードを追加",
    openLink: "開く",
    compareLink: "比較",
    compareLinkTitle: "このスカッドを比較対象Aにして比較画面へ",
    duplicateButton: "複製",
    saveAsTemplateButton: "テンプレ保存",
    renameButton: "名前変更",
    deleteButton: "削除",
    renamePrompt: "新しいスカッド名",
    deleteConfirmTemplate: "スカッド「{name}」を削除します。よろしいですか？（この端末のブラウザ内データのみ）",
    deleteConfirmButton: "削除する",
    deleteCancelButton: "やめる",
    deleteFailedFallback: "削除に失敗しました",
  },
  myTeamBuildPanel: {
    modalTitle: "保存ビルドを選択",
    intro:
      "このカードの選択中ビルドとお気に入りビルドを確認・変更できます。選択中ビルドとお気に入りビルドはそれぞれ独立しています。My Team の設定だけを変更します。保存済みスカッド・カード自体のお気に入りには自動適用されません。",
    cardDetailAriaTemplate: "{name} の選手詳細",
    cardImageAltTemplate: "{name} のカード画像",
    cardImageAltGeneric: "カード画像",
    cardTypeUnknown: "カードタイプ不明",
    registeredPositionUnknown: "登録ポジション不明",
    currentSettingsHeading: "現在の設定",
    selectedBuildLabel: "選択中ビルド: ",
    favoriteBuildLabel: "お気に入りビルド: ",
    noneLabel: "なし",
    selectedMissingTemplate: "選択中ビルドが見つかりません（削除済み・buildId {id}）",
    favoriteMissingTemplate: "お気に入りビルドが見つかりません（削除済み・buildId {id}）",
    buildIdSuffixTemplate: "（buildId {id}）",
    clearSelectedButton: "選択を解除",
    clearFavoriteButton: "お気に入りを解除",
    ownershipUsageTemplate: "所有状態: {ownership} / 使用状態: {usage}",
    unknownValuePlaceholder: "—",
    savedBuildCountTemplate: "保存ビルド {count} 件",
    storageUnavailable: "このブラウザでは保存できません（localStorage 不可）。設定・解除はできません。",
    staleNotice: "別のタブでデータが変更されました。",
    reloadButton: "再読込",
    confirmClearAria: "解除の確認",
    confirmClearTextTemplate: "{field}「{name}」を解除します（{fieldKey} を未設定に戻します）。",
    confirmClearUnchangedTemplate:
      "{otherField}・所有状態・使用状態・タグ・メモ・登録日時・保存ビルド本体・スカッド・カード自体のお気に入りは変更されません。",
    confirmClearButton: "解除する",
    cancelButton: "キャンセル",
    emptyBuildsHeading: "保存ビルドがありません",
    emptyBuildsBody: "選手詳細または選手比較で育成を調整し、「この育成を保存」から追加できます。",
    playerDetailLink: "このカードの選手詳細",
    progressionTabLink: "育成タブを開く",
    compareLink: "選手比較を開く",
    myBuildsLink: "My Builds を開く",
    searchLabel: "保存ビルドを検索（ビルド名・buildId）",
    searchPlaceholder: "決定力型 / b_xxxx",
    searchAriaLabel: "保存ビルドを検索",
    noSearchResults: "条件に一致する保存ビルドがありません。",
    manageInMyBuilds: "My Builds で管理",
    createBuildInProgression: "育成でビルドを作成",
    closeButton: "閉じる",
    footerNote: "名前変更・複製・削除・新規登録・配分編集は My Builds / 選手詳細で行います。ここでは選択中ビルドとお気に入りビルドの設定・解除だけを行います。",
    alreadySelectedNotice: "既に選択中ビルドです。",
    alreadyFavoriteNotice: "既にお気に入りビルドです。",
    setFailedTemplate: "設定できませんでした: {error}",
    unknownError: "不明なエラー",
    setSelectedSuccessTemplate: "「{name}」を選択中ビルドに設定しました。お気に入りビルドは変更していません。",
    setFavoriteSuccessTemplate: "「{name}」をお気に入りビルドに設定しました。選択中ビルドは変更していません。",
    clearFailedTemplate: "解除できませんでした: {error}",
    clearSelectedSuccess: "選択中ビルドを解除しました。お気に入りビルド・所有状態・使用状態・タグ・メモは変更していません。",
    clearFavoriteSuccess: "お気に入りビルドを解除しました。選択中ビルド・所有状態・使用状態・タグ・メモは変更していません。",
    deletedBuildFallback: "（削除済みビルド）",
    selectedBadge: "選択中",
    favoriteBadge: "お気に入り",
    selectedBuildNoun: "選択中ビルド",
    favoriteBuildNoun: "お気に入りビルド",
    allocationRowLabel: "育成配分: ",
    noAllocationBase: "配分なし（基礎能力値のまま）",
    allAllocationSummary: "全配分（10カテゴリ）",
    pointsUsedNoTotalTemplate: "使用 {used} pt / 合計 —",
    pointsUsedTotalTemplate: "使用 {used} / 合計 {total} pt",
    remainingUnknown: "残り —",
    remainingTemplate: "残り {remaining} pt",
    overAllocated: "配分超過",
    pomRowLabel: "Power of Many（ユーザー指定）: ",
    pomUnspecified: "未指定",
    experimentalLabel: " / 実験的試算: ",
    yes: "あり",
    no: "なし",
    estimatedOvrLabel: "保存時の推定OVR: ",
    calcModeConfirmed: "基礎値のみ",
    calcModeUnsupported: "計算不可",
    calcModeProvisional: "暫定規則",
    totalOvrPlaceholder: "総合値（ポジション別 OVR）: —（計算規則を確認中）",
    createdUpdatedTemplate: "作成 {created} / 更新 {updated}",
    setSelectedButton: "選択中ビルドに設定",
    setFavoriteButton: "お気に入りビルドに設定",
  },
  radarAxis: {
    attack: "シュート",
    pass: "パス",
    dribble: "ドリブル",
    defense: "ディフェンス",
    physical: "フィジカル",
    speed: "スピード",
    gk: "GK",
  },
  radarMode: {
    base: "基礎",
    progressed: "育成後",
    standard: "標準",
    conditional: "条件反映後",
    experimental: "実験",
  },
  myBuildCard: {
    selectPlayerDetailAriaTemplate: "{name} の選手詳細",
    cardImageAltResolving: "カード画像（解決中）",
    maxBaseOvrTemplate: "最大 {max} / 基礎 {base}",
    fetchFailedNote: "カード情報を取得できませんでした。時間をおいて再読み込みしてください（ビルドは保持されています）。",
    allocationHeading: "育成配分",
    viewAllAllocationsSummary: "全配分（10カテゴリ）を見る",
    legacyBuildWarningTemplate: "旧規則ビルド（rulesVersion: {version}）。現行規則への自動変換は行っていません。",
    playerBoosterEstimateTemplate: "選手ブースター試算あり（ID {id}・確認済みのゲーム内仕様ではありません）",
    estimatedOvrTemplate: "保存時の推定OVR: {ovr}（{mode}）",
    usageHeading: "使用状況",
    squadUsingSuffixTemplate: "（{areas}）で使用中",
    squadUsingLinkTemplate: "スカッド「{name}」",
    noUsageLabel: "参照なし",
    playerDetailLink: "選手詳細",
    openProgressionLink: "育成で開く",
    addToCompareButton: "比較へ追加",
    useInSquadLink: "スカッドで使用",
    myTeamIntegrationHeading: "My Team 連携",
    notInMyTeamLabel: "My Team未登録（このカードは My Team にありません）",
    registerToMyTeamButton: "My Teamに登録",
    openMyTeamLink: "My Team を開く",
    registerHintNote: "登録時に所有状態・使用状態と、このビルドを選択中ビルド／お気に入りビルドにするかを選べます。既存スカッド・カード自体のお気に入りは変更されません。",
    selectedBuildLabel: "選択中ビルド:",
    selectedInMyTeamBadge: "My Team で選択中",
    clearSelectionButton: "選択を解除",
    useInMyTeamButton: "My Team で使用",
    favoriteBuildLabel: "お気に入りビルド:",
    favoriteInMyTeamBadge: "My Team のお気に入りビルド",
    clearFavoriteButton: "お気に入りを解除",
    setFavoriteButton: "お気に入りビルドに設定",
    favoriteHintNote: "これは保存ビルドのお気に入り設定です。カード自体のお気に入り状態・既存スカッドは変更されません。",
    renameButton: "名前を変更",
    duplicateButton: "複製",
    deleteButton: "削除",
  },
  buildExportModal: {
    launcherHeading: "保存ビルドの書き出し（ローカルバックアップ）",
    launcherDescription:
      "保存ビルドをこのブラウザー内で JSON ファイルにまとめ、お使いの端末へ保存します。全件、または選択した保存ビルドだけを書き出せます。サーバーや外部サービスへは送信しません。書き出しても保存ビルドは変更されません。対応ブラウザーでは保存場所の選択画面が表示されます（Windows の「ドキュメント」フォルダーを選ぶことをおすすめします）。非対応の場合は通常のダウンロード先へ保存します。",
    launcherButton: "保存ビルドを書き出す",
    noBuildsNote: "保存ビルドがありません。選手詳細・選手比較の「この育成を保存」から追加すると書き出せます。",
    unavailableNote: "このブラウザーでは localStorage が使えないため、書き出しできません。",
    safetyLine1: "このブラウザー内だけで処理し、サーバーや外部サービスへは送信しません（アップロードもしません）。",
    safetyLine2: "書き出しても保存ビルド・My Team・スカッド・カードのお気に入りは変更されません。",
    safetyLine3: "出力されるのは保存ビルドの育成データ（配分・規則バージョン・保存時の推定値など）だけです。",
    safetyLine4: "My Team のメモ・タグ・所有/使用状態・選択中/お気に入りビルド、スカッド、認証情報、環境情報は含めません。",
    staleNoticeText: "別のタブで保存ビルドが更新されました。再読込して内容を確認してください。",
    reloadButton: "再読込",
    droppedNoticeTemplate: "選択していた保存ビルドのうち {count} 件が削除されたため、選択から外しました。",
    errorSelectBuilds: "書き出す保存ビルドを選んでください。",
    errorSelectionChanged: "選択した保存ビルドの状態が変わっています。再読込してください。",
    conflictListChangedTemplate: "保存ビルドの一覧が変わりました（追加 {added} 件 / 削除 {removed} 件）。再読込して内容を確認してください。",
    conflictSelectionNotFound: "選択した保存ビルドが見つかりません。再読込してください。",
    conflictSelectionChangedTemplate: "選択した保存ビルドが別のタブで変更されました（削除 {removed} 件 / 変更 {changed} 件）。再読込して内容を確認してください。",
    saveFailedNote: "この環境ではファイルを保存できませんでした。保存ビルドは変更していません。",
    jsonFileTypeDescription: "JSON ファイル",
    titleChoose: "保存ビルドを書き出す",
    titleConfirm: "書き出し内容の確認",
    titleDone: "書き出し完了",
    doneMessagePickerTemplate: "{count} 件の保存ビルドを「{filename}」として選んだ場所へ保存しました。保存ビルドは変更していません。",
    doneMessageDownloadTemplate: "{count} 件の保存ビルドを「{filename}」としてダウンロードしました。保存ビルドは変更していません。",
    downloadFallbackNote: "このブラウザーは保存場所の選択に対応していないため、通常のダウンロード先へ保存しました。",
    utcNotePrefix: "ファイル名の日時と ",
    utcNoteSuffix: " はいずれも UTC（協定世界時）です。",
    backButton: "戻る",
    closeButton: "閉じる",
    cancelButton: "キャンセル",
    nextButton: "次へ（内容を確認）",
    choosePickerLocationButton: "保存場所を選ぶ",
    downloadJsonButton: "JSON をダウンロード",
    exportMethodLegend: "書き出し方式",
    exportAllOptionTemplate: "すべての保存ビルドを書き出す（{count} 件）",
    exportSelectionOption: "選択した保存ビルドだけを書き出す",
    exportSelectionHint: "この選択はこのダイアログ内だけのものです（My Builds 一覧の検索・絞り込みとは独立しています）。",
    searchTargetLabel: "対象を検索（ビルド名・選手名・World ID・buildId）",
    searchAriaLabel: "書き出す保存ビルドを検索",
    selectAllVisibleTemplate: "表示中をすべて選択（{count} 件）",
    clearVisibleSelectionButton: "表示中の選択を解除",
    selectedCountTemplate: "選択 {count} 件",
    noSavedBuildsLabel: "保存ビルドがありません。",
    noMatchingBuildsLabel: "検索条件に一致する保存ビルドがありません。",
    includeInExportAriaTemplate: "{buildName}（{name}）を書き出しに含める",
    usedBadge: "使用中",
    unusedBadge: "未使用",
    updatedTemplate: "更新 {date}",
    exportContentHeading: "書き出す内容",
    allBuildsLabel: "すべての保存ビルド",
    selectedBuildsLabel: "選択した保存ビルド",
    targetPrefixTemplate: "対象: {target}（",
    targetCountSuffix: " 件）",
    formatLabelPrefix: "形式: ",
    formatVersionLabelPrefix: " / formatVersion ",
    formatVersionNote: "（エクスポートファイルの形式バージョンです。保存ビルドの rulesVersion・schemaVersion とは別物です）",
    singleJsonFileNote: "UTF-8 の JSON ファイル 1 つ。ZIP・CSV・暗号化・圧縮はしません。",
    exportedAtNoteSuffix: " とファイル名の日時は、保存時の UTC（協定世界時）で確定します。",
    itemCountNoteMiddle: " は ",
    itemCountNoteSuffix: " の件数と一致します。並び順は決定的（更新日時の新しい順 → buildId 順）です。",
    aboutSaveLocationHeading: "保存場所について",
    pickerInstructionPrefix: "「保存場所を選ぶ」を押すと、保存場所の選択画面が表示されます。",
    pickerInstructionBold: "Windows の「ドキュメント」フォルダーを選択してください。",
    pickerNote1Prefix: "保存場所は",
    pickerNote1Bold: "ユーザー自身が選択",
    pickerNote1Suffix: "します。アプリが保存先を無断で固定することはありません。",
    pickerNote2: "ファイルは外部サービスへ送信されません。",
    pickerNote3: "保存ビルドの元データは変更されません。",
    pickerNote4Prefix: "保存場所の選択を",
    pickerNote4Bold: "キャンセルした場合は何も保存されません",
    pickerNote4Suffix: "。",
    pickerNote5: "ブラウザーが保存場所の選択に対応しない場合は、通常のダウンロード先へ保存されます。",
    noPickerNote:
      "このブラウザーは保存場所の選択画面に対応していないため、通常のダウンロード先（ブラウザー設定に従います）へ保存されます。ダウンロード後、必要であれば「ドキュメント」フォルダーへファイルを移動してください。外部サービスへの送信はありません。保存ビルドの元データは変更されません。",
    pickerNextNoteTemplate:
      "「保存場所を選ぶ」を押すと、直前にもう一度保存ビルドを取得し、対象・worldCardId・更新日時・形式を検証してから保存します。差異や無効データがある場合は保存せず、再読込を案内します。",
    downloadNextNoteTemplate:
      "「JSON をダウンロード」を押すと、直前にもう一度保存ビルドを取得し、対象・worldCardId・更新日時・形式を検証してから保存します。差異や無効データがある場合は保存せず、再読込を案内します。",
    cancelledNoticeTemplate: "保存場所の選択をキャンセルしました。保存ビルドは変更していません。もう一度「保存場所を選ぶ」を押すとやり直せます。",
    exportTargetLineTemplate: "書き出し対象: {target} {count} 件",
    exportFailureEmpty: "書き出せる保存ビルドがありません。",
    exportFailureInvalidTemplate:
      "無効な保存ビルドが {invalid} 件あります（書き出せるのは {valid} 件）。安全のため書き出しを中止しました。My Builds で対象を確認してください。",
  },
  buildImportModal: {
    safetyLine1: "対応するのは、前回このアプリの「保存ビルドを書き出す」で作ったローカル JSON ファイルだけです。",
    safetyLine2: "ファイルはこのブラウザー内だけで処理し、サーバーや外部サービスへは送信しません（アップロードしません）。",
    safetyLine3: "ファイルを選んだだけ・プレビューを開いただけでは保存されません。最終確認を押したときだけ保存します。",
    safetyLine4: "既存の保存ビルドは上書き・削除しません。buildId が既存と重複する場合は新しい buildId で追加します。",
    safetyLine5: "読み込んだビルドを My Team・スカッド・カードのお気に入りへ自動で適用しません（参照も作りません）。",
    safetyLine6: "未対応の formatVersion のファイルは変換せず拒否します。",
    safetyLine7: "読み込み後は My Builds で個別に管理してください（選択中ビルド・お気に入りには自動設定しません）。",
    launcherHeading: "保存ビルドの読み込み（ローカル JSON インポート）",
    launcherDescriptionPrefix:
      "前回このアプリから書き出したローカル JSON ファイルを選ぶと、内容を検証してプレビューし、最終確認のうえ保存ビルドとして",
    addBoldLabel: "追加",
    launcherDescriptionSuffix: "します。「書き出す」とは別の操作です。",
    launcherButton: "保存ビルドを読み込む",
    unavailableNote: "このブラウザーでは localStorage が使えないため、読み込みできません。",
    validateErrorTemplate: "ファイル内の保存ビルドに無効なものが {invalid} 件あります（有効 {valid} 件）。安全のため、このファイルは読み込めません。",
    duplicateErrorTemplate: "ファイル内で buildId が重複しています（{count} 件）。正式なエクスポートファイルでは起こらないため、このファイルは読み込めません。",
    parseErrorEmpty: "ファイルが空です。",
    parseErrorTooLarge: "ファイルまたはビルド件数が大きすぎます。",
    parseErrorNotJson: "JSON として読み取れません。",
    parseErrorNotObject: "エクスポートファイルの構造ではありません。",
    parseErrorUnsafeKeys: "未知または安全でない項目を含むため読み込めません。",
    parseErrorFormatMismatch: "このアプリの保存ビルドエクスポートファイルではありません。",
    parseErrorUnsupportedVersion: "未対応の formatVersion です。アプリの更新が必要です。",
    parseErrorExportedAt: "exportedAt の日時が不正です。",
    parseErrorItemCount: "itemCount が不正です。",
    parseErrorItemCountMismatch: "itemCount と実際の件数が一致しません。",
    parseErrorGeneric: "ファイルを読み込めません。",
    tooLargeTemplate: "ファイルが大きすぎます（上限 {max}MB）。",
    noFileApiError: "このブラウザーではファイルを読み込めません。",
    readFailedError: "ファイルを読み込めませんでした。",
    importConflictTemplate:
      "別のタブで保存ビルドが更新されました。既存データを再読込して、インポート内容をもう一度確認してください。（既存の追加 {added} 件 / 削除 {removed} 件 / 変更 {changed} 件）",
    saveConflictNote: "別のタブで保存ビルドが更新されました。再読込して、もう一度確認してください。",
    quotaError: "保存できませんでした。保存容量が不足している可能性があります。既存の保存ビルドは変更していません。",
    storageError: "このブラウザーでは保存できませんでした。既存の保存ビルドは変更していません。",
    genericSaveError: "保存に失敗しました。既存の保存ビルドは変更していません。",
    reverifyFailedNote: "保存結果の再検証に失敗しました。My Builds の一覧を再読込して確認してください。",
    titleSelect: "保存ビルドを読み込む",
    titleError: "ファイルを読み込めませんでした",
    titlePreview: "インポート内容の確認",
    titleConfirm: "インポートの最終確認",
    titleSaving: "読み込み中",
    titleDone: "読み込み完了",
    titleSaveFail: "読み込みに失敗しました",
    staleBlockedText: "別のタブで保存ビルドが更新されました。既存データを再読込して、インポート内容をもう一度確認してください。",
    reloadExistingButton: "既存データを再読込",
    savingText: "読み込み中です…",
    doneMessageTemplate: "保存ビルドを {count} 件読み込みました。既存ビルドは変更していません。",
    doneNewIdsTemplate: "このうち {count} 件は、既存 buildId との衝突を避けるため新しい buildId で追加しました。",
    doneManageNote: "読み込んだビルドは My Builds で個別に管理できます。選択中ビルド・お気に入りビルド・スカッドには自動設定していません。",
    saveFailFallback: "読み込みに失敗しました。",
    cancelButton: "キャンセル",
    pickAnotherFileButton: "ファイルを選び直す",
    importButtonTemplate: "インポートする（{count} 件）",
    closeButton: "閉じる",
    supportedFilesHeading: "対応ファイル",
    supportedFile1Prefix: "前回このアプリの「保存ビルドを書き出す」で作った JSON ファイル（",
    supportedFile1Middle: " / formatVersion ",
    supportedFile1Suffix: "）",
    supportedFile2: "拡張子だけでは判定しません。中身を JSON として解析し、形式・件数・各ビルドを検証します。",
    supportedFile3Template: "ファイルサイズ上限 {maxSize}MB / 件数上限 {maxCount} 件。",
    supportedFile4:
      "対象外: SavedBuild 単体 JSON / localStorage 全体 / My Team / スカッド / カードお気に入り / CSV / ZIP / TXT / JavaScript / HTML / 未対応 formatVersion。",
    selectFileLabel: "インポートする JSON ファイルを選択",
    selectFileHint: "ファイルを選んだだけでは保存されません。内容を確認し、最終確認を押したときだけ保存します。",
    validatingText: "ファイルを検証中です…",
    selectedFileTemplate: "選択中: {name}",
    selectedFileSizeTemplate: "（{size}）",
    validateInfoTemplate: "無効 {invalid} 件 / 有効 {valid} 件。部分的な読み込みはしません。",
    duplicateIdsTemplate: "重複 buildId: {ids}",
    fileHeading: "ファイル",
    fileNameLabel: "ファイル名",
    fileSizeLabel: "サイズ",
    validationHeading: "検証結果",
    validCountLabel: "有効件数",
    plannedSaveCountLabel: "保存予定件数",
    collisionCountLabel: "buildId 衝突（新 ID 発行）",
    saveCountNoteTemplate: "{count} 件を新しい保存ビルドとして追加します。既存ビルドは変更しません。",
    targetBuildsSummaryTemplate: "対象ビルド（{count} 件）",
    newBuildIdBadge: "新しい buildId",
    pomBadge: "Power of Many 指定",
    experimentalBadge: "実験的試算",
    worldIdOriginalTemplate: "World ID {worldId} / 元 buildId {originalId}",
    finalBuildIdTemplate: " → インポート後 buildId {finalId}",
    noChangeLabel: "（変更なし）",
    rulesVersionTemplate: "rulesVersion {version}",
    allocationLabelTemplate: "配分: {allocation}",
    createdUpdatedNoteTemplate: "作成 {created} / 更新 {updated}（日時は維持します）",
    unaffectedHeading: "この読み込みで変更しないもの",
    unaffected1: "既存の保存ビルド（上書き・削除しません）",
    unaffected2: "My Team（選択中ビルド・お気に入りビルド・所有/使用状態・タグ・メモ）",
    unaffected3: "保存スカッド（配置・savedBuildId 参照）",
    unaffected4: "カード自体のお気に入り",
    unaffected5: "外部サービスへは送信しません",
    unaffectedFootnote:
      "読み込んだビルドは selectedBuildId / favoriteBuildId / スカッドの savedBuildId へ自動設定しません。My Builds の使用状況では「参照なし」として表示されます。",
    confirmTitleTemplate: "{count} 件の保存ビルドを追加します",
    confirmNote1: "既存の保存ビルドは上書き・削除しません。",
    confirmCollisionTemplate: "このうち {count} 件は、既存 buildId との衝突を避けるため新しい buildId で追加します。",
    confirmNoCollision: "buildId の衝突はありません。",
    confirmNote2: "My Team・スカッド・カードのお気に入りは変更しません。",
    confirmNote3: "保存の直前に、既存データをもう一度取得して競合がないか確認します。",
    confirmButton: "確定してインポート",
  },
  duplicateReviewTeaser: {
    bodyPrefix: "JSON インポートや複製で増えた可能性がある保存ビルドの",
    duplicateCandidatesLabel: "重複候補",
    bodySuffix: "は、保存ビルド分析（Build Inventory）で安全に確認できます。この画面からは削除・統合・上書きしません。",
    openInventoryLink: "Build Inventory で重複候補を確認",
  },
  myBuildsView: {
    pageTitle: "My Builds",
    pageDescription: "選手詳細・選手比較・My Team・スカッド編集で保存した育成ビルドを、一覧・検索・名前変更・複製・削除できます。保存形式は既存のまま（このブラウザにのみ保存）です。",
    sortUpdatedDesc: "更新が新しい順",
    sortUpdatedAsc: "更新が古い順",
    sortCreatedDesc: "作成が新しい順",
    sortCreatedAsc: "作成が古い順",
    sortNameAsc: "ビルド名順",
    sortPlayerAsc: "選手名順",
    renameTargetMissing: "対象のビルドが見つかりません",
    renamedNoticeTemplate: "ビルド名を「{name}」に変更しました。",
    duplicateFailedTemplate: "複製できませんでした: {error}",
    duplicatedNoticeTemplate: "「{name}」として複製しました。",
    deleteFailedTemplate: "削除できませんでした: {error}",
    deletedNotice: "保存ビルドを削除しました。My Team・スカッド本体は変更していません。",
    alreadyRegisteredNotice: "このカードは既に My Team へ登録されています。再読込してください。",
    registerFailedTemplate: "My Team へ登録できませんでした: {error}",
    favoriteAlsoSetTemplate: "『{name}』をお気に入りビルドにも設定しました。",
    favoriteSetFailedNote: "ただしお気に入りビルドの設定だけ失敗しました。My Builds から設定し直せます（登録自体は成功しています）。",
    selectedAlsoSetTemplate: "『{name}』を選択中ビルドに設定しました。",
    registeredNoticeTemplate: "{name} を My Team へ登録しました。{selNote}{favoriteNote}",
    alreadySelectedNotice: "このビルドは既に My Team の選択中ビルドです。",
    assignFailedTemplate: "My Team に設定できませんでした: {error}",
    assignedNoticeTemplate: "「{name}」を My Team の選択中ビルドに設定しました（選択中ビルド以外は変更していません）。",
    selectionChangedError: "選択状態が変わっています。再読込してください。",
    clearSelectionFailedTemplate: "解除できませんでした: {error}",
    clearedSelectionNotice: "My Team の選択中ビルドを解除しました（お気に入りビルド・他の情報は変更していません）。",
    alreadyFavoriteNotice: "このビルドは既に My Team のお気に入りビルドです。",
    setFavoriteFailedTemplate: "お気に入りビルドに設定できませんでした: {error}",
    setFavoriteNoticeTemplate: "「{name}」を My Team のお気に入りビルドに設定しました。選択中ビルドは変更していません。",
    clearFavoriteFailedTemplate: "お気に入りを解除できませんでした: {error}",
    clearedFavoriteNoticeTemplate: "「{name}」を My Team のお気に入りビルドから解除しました。選択中ビルドは変更していません。",
    unknownError: "不明なエラー",
    emptyTitle: "保存ビルドがありません",
    emptyDescription: "選手詳細または選手比較で育成を調整し、「この育成を保存」から追加できます。",
    findPlayersLink: "選手を探す",
    openComparelink: "選手比較を開く",
    openMyTeamLink: "My Team を開く",
    openSquadsLink: "スカッドを開く",
    storageUnavailableNotice: "このブラウザでは localStorage が使えないため、保存ビルドの表示・変更ができません。",
    staleBuildsNotice: "別のタブで保存ビルドが更新されました。",
    staleMyTeamNotice: "別のタブで My Team が更新されました。",
    reloadButton: "再読込",
    statTotalLabel: "保存ビルド数",
    statVisibleLabel: "表示中",
    statUsedLabel: "使用中",
    statUnusedLabel: "未使用",
    usedExplanationNote: "「使用中」は My Team の選択中／お気に入りビルド、またはスカッドの保存ビルド参照がある件数です。",
    filterSectionHeading: "検索・絞り込み・並び替え",
    filterActiveBadge: "適用中",
    searchLabel: "検索（ビルド名・選手名・World ID・buildId）",
    searchPlaceholder: "メッシ / RWF / 89138556575063 / 決定力型",
    searchAriaLabel: "保存ビルドを検索",
    cardTypeLabel: "カードタイプ",
    cardTypeAriaLabel: "カードタイプで絞り込み",
    filterAllOption: "すべて",
    positionLabel: "登録ポジション",
    positionAriaLabel: "登録ポジションで絞り込み",
    rulesLabel: "規則",
    rulesAriaLabel: "規則バージョンで絞り込み",
    pomLabel: "Power of Many",
    pomAriaLabel: "Power of Many 指定で絞り込み",
    pomWithOption: "指定あり",
    experimentalLabel: "実験的試算",
    experimentalAriaLabel: "実験的試算で絞り込み",
    experimentalWithOption: "試算あり",
    usageLabel: "使用状況",
    usageAriaLabel: "使用状況で絞り込み",
    usageUsedOption: "使用中",
    usageUnusedOption: "未使用",
    sortLabel: "並び替え",
    sortAriaLabel: "並び替え",
    clearFiltersButton: "検索条件を解除",
    noResultsTitle: "条件に一致する保存ビルドがありません",
    deleteConfirmTitle: "この保存ビルドを削除しますか？",
    deleteConfirmButton: "削除する",
    clearSelectionConfirmTitle: "My Team の選択中ビルドを解除しますか？",
    clearSelectionConfirmButton: "解除する",
    clearSelectionBodyTemplate: "{name} を My Team の選択中ビルドから外します（selectedBuildId を未選択に戻します）。",
    idLineTemplate: "World ID {worldCardId} / buildId {buildId}",
    clearSelectionUnchangedNote: "保存ビルド本体・お気に入りビルド・所有状態・使用状態・タグ・メモ・スカッド・お気に入りは変更されません。",
    clearFavoriteConfirmTitle: "My Team のお気に入りビルドを解除しますか？",
    clearFavoriteConfirmButton: "お気に入りを解除する",
    clearFavoriteBodyTemplate: "My Team のお気に入りビルドから {name} を解除します（favoriteBuildId を未設定に戻します）。",
    clearFavoriteChangedItem: "変更される項目: favoriteBuildId と更新日時のみ",
    clearFavoriteUnchangedItemTemplate:
      "変更されない項目: 選択中ビルド（selectedBuildId）・所有状態・使用状態・タグ・メモ・登録日時・他のカードの My Team レコード・保存ビルド本体・スカッド・カード自体のお気に入り・比較状態",
    registerModalTitle: "My Team に登録",
    cardImageAltTemplate: "{name} のカード画像",
    cardImageAltGeneric: "カード画像",
    cardTypeUnknown: "カードタイプ不明",
    registeredPositionUnknown: "登録ポジション不明",
    alreadyInMyTeamNotice: "このカードは既に My Team へ登録されています。再読込してください。",
    buildToUseLabel: "使用する保存ビルド: ",
    buildIdSuffixTemplate: "（buildId {id}）",
    allocationLabel: "育成配分: ",
    noAllocationBase: "配分なし（基礎能力値のまま）",
    usedPointsLabel: "使用ポイント: {value}",
    totalUnknownSuffix: " pt（合計は不明）",
    totalPointsSuffixTemplate: " / {value} pt",
    pomRowLabel: "Power of Many（ユーザー指定）: ",
    pomUnspecified: "未指定",
    experimentalRowLabel: "実験的試算: ",
    yes: "あり",
    no: "なし",
    estimatedOvrLabel: "保存時の推定OVR: ",
    calcModeConfirmed: "基礎値のみ",
    calcModeUnsupported: "計算不可",
    calcModeProvisional: "暫定規則",
    totalOvrPlaceholder: "総合値（ポジション別 OVR）: —（計算規則を確認中）",
    ownershipLabel: "所有状態",
    ownershipHint: "My Team は実際に保有しているカードの管理用です。あとで My Team 画面から変更できます。",
    usageStatusLabel: "使用状態",
    usageStatusHint: "スカッド配置の事実とは別です。ここで選んでもスカッドへ自動配置しません。",
    associationLegend: "保存ビルドの関連付け（それぞれ独立した設定です）",
    setSelectedOptionPrefix: "このビルドを",
    setSelectedOptionSuffix: "（selectedBuildId）に設定する",
    setSelectedHint: "My Team 画面でこのカードを開いたとき最初に表示されるビルドです。",
    setFavoriteOptionPrefix: "このビルドを",
    setFavoriteOptionSuffix: "（favoriteBuildId）に設定する",
    setFavoriteHint: "選択中ビルドとは別の枠です。カード自体のお気に入り状態とも別です。",
    previewHeading: "作成される My Team レコード",
    previewOwnershipTemplate: "所有状態: {value}",
    previewUsageTemplate: "使用状態: {value}",
    previewSelectedTemplate: "選択中ビルド: {value}",
    previewFavoriteTemplate: "お気に入りビルド: {value}",
    previewTagsNone: "タグ: なし",
    previewNotesNone: "メモ: なし",
    previewSquadNoChange: "スカッド: 変更なし（自動配置・自動適用しません）",
    previewFavoriteFlagNoChange: "カード自体のお気に入り: 変更なし",
    previewNoneValue: "なし",
    twoStageNote: "お気に入りビルドは登録後にもう 1 度保存します。万一そこだけ失敗しても登録自体は有効です（あとで My Builds から設定できます）。",
    unchangedListItem1: "他のカードの My Team レコード・保存ビルド本体・保存スカッドは変更されません。",
    unchangedListItem2: "カード自体のお気に入り（favorites）・比較状態・URL は変更されません。",
    confirmStatement: "「このカードを My Team へ登録します。」",
    cancelButton: "キャンセル",
    registerButton: "My Team に登録",
    changeFavoriteModalTitle: "My Team のお気に入りビルドを変更",
    notInMyTeamNotice: "このカードは My Team に登録されていません。My Team に登録してから設定してください。",
    settingBuildLabel: "設定するビルド: ",
    currentFavoriteLabel: "現在のお気に入りビルド: ",
    noneLabel: "なし",
    currentFavoriteMissingTemplate: "現在のお気に入りビルドは見つかりません（buildId {id}）",
    currentSelectedUnchangedLabel: "現在の選択中ビルド（変更しません）: ",
    missingBuildFallback: "（見つかりません）",
    alreadyFavoriteNoChangeNote: "このビルドは既にお気に入りです。変更はありません。",
    confirmFavoriteChangeTemplate: "「My Team のお気に入りビルドを『{name}』へ変更します。」",
    favoriteChangedItem: "変更される項目: My Team レコードの favoriteBuildId と更新日時のみ",
    favoriteUnchangedItemTemplate:
      "変更されない項目: 選択中ビルド（selectedBuildId）・所有状態・使用状態・タグ・メモ・登録日時・他のカードの My Team レコード・保存ビルド本体・スカッド・カード自体のお気に入り・比較状態",
    favoriteNoAutoApplyNote: "選択中ビルドと既存スカッドには自動適用されません。",
    makeFavoriteButton: "お気に入りビルドにする",
    changeSelectedModalTitle: "My Team の選択中ビルドを変更",
    currentSelectedLabel: "現在の選択中ビルド: ",
    currentSelectedMissingTemplate: "現在の選択中ビルドは見つかりません（buildId {id}）",
    alreadySelectedNoChangeNote: "このビルドは既に選択中です。変更はありません。",
    confirmSelectedChangeTemplate: "「My Team の選択中ビルドを『{name}』へ変更します。」",
    selectedChangedItem: "変更される項目: My Team レコードの選択中ビルド（selectedBuildId）と更新日時のみ",
    selectedUnchangedItemTemplate:
      "変更されない項目: お気に入りビルド、所有状態、使用状態、タグ、メモ、登録日時、他のカードの My Team レコード、保存ビルド本体、スカッド、お気に入り、比較状態",
    selectedNoAutoApplyNote: "既存スカッドには自動適用されません（各スカッドの保存ビルドは独立した設定です）。",
    makeSelectedButton: "My Team の選択中ビルドにする",
    renameModalTitle: "ビルド名を変更",
    renameDescription: "変更されるのはビルド名と更新日時だけです。buildId・配分・規則バージョン・作成日時・Power of Many 指定は保持されます。",
    newNameLabel: "新しいビルド名（1〜60文字）",
    newNameAriaLabel: "新しいビルド名",
    changeButton: "変更する",
    deleteBodyTemplate: "{name}{playerSuffix} を削除します。",
    referencedFromLabel: "このビルドは次から参照されています:",
    myTeamSelectedItem: "My Team で選択中",
    myTeamFavoriteItem: "My Team のお気に入りビルド",
    squadReferenceTemplate: "スカッド「{name}」（{areas}）",
    deleteSafeNote: "削除しても My Team・スカッド本体・カード配置・お気に入りは変更されません。参照先が「削除済み」と表示され、別のビルドを選び直す必要があります。",
    noReferenceNote: "このビルドはどこからも参照されていません。",
    deleteIrreversibleNote: "この操作は元に戻せません。",
  },
  compareAddButton: {
    fullMessageTemplate: "比較は最大{max}人です",
    removeFromCompareAria: "比較から外す",
    addToCompareAria: "比較へ追加",
    inCompareLabel: "比較中",
    compareFullLabel: "比較満員",
    addToCompareLabel: "比較へ追加",
    inCompareCheckedLabel: "比較中 ✓",
    viewCompareTemplate: "比較を見る ({count})",
  },
  duplicateReviewSection: {
    sortUpdatedDesc: "更新日時が新しい順",
    sortCreatedDesc: "作成日時が新しい順",
    sortSizeDesc: "グループ内件数が多い順",
    sortRefsDesc: "合計参照数が多い順",
    sortUnusedFirst: "未使用候補を先頭",
    sortUsedFirst: "使用中候補を先頭",
    sortPlayerAsc: "選手名順",
    sortNameAsc: "ビルド名順",
    sortIdStable: "buildId 順（安定）",
    headingTemplate: "保存ビルド重複候補（{count} グループ）",
    intro1:
      "JSON インポートや複製で増えた可能性がある保存ビルドの重複候補を安全に確認するための読み取り専用の一覧です。この画面から保存ビルドを削除・統合・上書き・一括処理・付け替えすることはありません。My Team・スカッドの参照も変更しません。個別の判断・整理は My Builds で行ってください。",
    intro2:
      "完全一致候補は、World ID（worldCardId）・rulesVersion・育成配分・選手ブースター試算・Power of Many 指定がすべて一致する保存ビルドです（ビルド名・buildId・作成日時・更新日時が違っても一致として扱います）。",
    intro3:
      "類似候補は誤判定を避けるため範囲を限定しています。「配分が 1 カテゴリだけ異なる」「選手ブースター試算・Power of Many 指定だけが異なる」場合だけを安全に検出し、それ以外の差分は候補にしません。",
    staleNoticeTemplate: "別のタブで重複判定対象データ（{targets}）が更新されました。",
    staleBuildLabel: "保存ビルド",
    staleMyTeamLabel: "My Team",
    staleSquadLabel: "スカッド",
    totalBuildsLabel: "保存ビルド総数",
    exactGroupCountLabel: "完全一致候補グループ",
    exactBuildCountLabel: "完全一致候補ビルド数",
    similarGroupCountLabel: "類似候補グループ",
    similarBuildCountLabel: "類似候補ビルド数",
    noCandidateLabel: "重複候補なし",
    unresolvedLabel: "判定不能",
    usedCandidateLabel: "使用中の重複候補",
    unusedCandidateLabel: "未使用の重複候補",
    myTeamRefCandidateLabel: "My Team で参照中の候補",
    squadRefCandidateLabel: "スカッドで参照中の候補",
    unitBuildSuffix: "ビルド",
    unitGroupSuffix: "グループ",
    footnote: "単位: 「ビルド」= 保存ビルド単位・「グループ」= 重複候補としてまとめた単位（類似候補は 2 件 1 組）。",
    statusLabel: "状態: ",
    statusWarning: "注意（重複候補あり）",
    statusNormal: "正常",
    unresolvedSuffix: "／ 判定不能ビルドあり",
    unresolvedSummaryTemplate: "判定不能ビルド（{count} 件・重複候補なしには含めていません）",
    worldIdTemplate: "World ID {id}",
    worldIdUnknown: "World ID 不明",
    buildIdTemplate: "buildId {id}",
    buildIdUnknown: "buildId 不明",
    unresolvedFootnote: "自動修復・自動削除は行いません。My Builds または本ページの一覧で内容を個別に確認してください。",
    similarUnsupportedNote: "類似候補の自動判定は、誤判定を避けるため現在は行っていません。",
    noBuildsLabel: "保存ビルドがありません。",
    noExactMatchLabel: "完全一致する保存ビルド候補はありません。",
    noMatchingCandidatesLabel: "条件に一致する重複候補はありません。",
    searchFilterSortHeading: "検索・絞り込み・並び替え",
    filterActiveLabel: "適用中",
    searchLabel: "検索（選手名・ビルド名・World ID・buildId・rulesVersion・スカッド名）",
    searchAriaLabel: "重複候補を検索",
    kindFilterLabel: "種類",
    allOption: "すべて",
    exactOption: "完全一致候補",
    similarOption: "類似候補",
    usageFilterLabel: "使用状況",
    usedOption: "使用中",
    unusedOption: "未使用",
    rulesFilterLabel: "規則",
    currentRulesOption: "現行規則",
    legacyRulesOption: "旧規則",
    cardTypeFilterLabel: "カードタイプ",
    registeredPositionFilterLabel: "登録ポジション",
    myTeamRefCheckLabel: "My Team参照あり",
    squadRefCheckLabel: "スカッド参照あり",
    multiUseCheckLabel: "複数箇所で使用中",
    pomCheckLabel: "Power of Many指定あり",
    experimentalCheckLabel: "実験的試算あり",
    sortLabel: "並び替え",
    clearSearchButton: "検索条件を解除",
    exactBadge: "完全一致候補",
    similarBadge: "類似候補",
    buildCountSuffix: "件",
    anyUsedBadge: "使用中を含む",
    allUnusedBadge: "すべて未使用",
    matchingFieldsHeading: "一致している項目",
    differingFieldsHeading: "異なる項目",
    similarReasonTemplate: "類似の理由: {reason}",
    usedRefTemplate: "使用中 {count} 参照",
    unusedBadge: "未使用",
    multiUseBadge: "複数箇所",
    pomBadge: "Power of Many指定",
    experimentalBadge: "実験的試算",
    selectedBoosterLabel: "selectedPlayerBooster: ",
    pomFieldLabel: " / Power of Many: ",
    estimatedOvrLabel: "保存時の推定OVR: ",
    myTeamSelectedInline: "My Team 選択中 / ",
    myTeamFavoriteInline: "My Team お気に入り / ",
    noReferenceLabel: "参照なし",
    openMyTeamLink: "My Team を開く",
    openSquadTemplate: "「{name}」を開く",
  },
  buildInventoryView: {
    pageTitle: "保存ビルド分析",
    pageDescription: "保存ビルドの使用状況、重複候補、旧規則、参照問題を確認できます。育成配分・My Team・スカッドは変更しません。育成目的は、Build Analysisで明示的に保存操作を行った場合に限り、該当する保存ビルドへ追加保存されます。",
    sortUpdatedDesc: "更新が新しい順",
    sortUpdatedAsc: "更新が古い順",
    sortCreatedDesc: "作成が新しい順",
    sortPlayerAsc: "選手名順",
    sortNameAsc: "ビルド名順",
    sortRefsDesc: "参照数が多い順",
    sortRefsAsc: "参照数が少ない順",
    sortProblemFirst: "問題のあるビルドを先頭",
    sortUnusedFirst: "未使用ビルドを先頭",
    issueMissing: "削除済み参照",
    issueMismatch: "worldCardId 不一致",
    issueInvalidBuildId: "不正 buildId",
    issueUnknown: "不明参照",
    emptyTitle: "保存ビルドがありません",
    emptyDescription: "選手詳細または選手比較で育成を調整し、「この育成を保存」から追加できます。",
    openCompareLink: "選手比較を開く",
    openMyBuildsLink: "My Builds を開く",
    openMyTeamLink: "My Team を開く",
    openSquadsLink: "スカッドを開く",
    storageWarningTemplate: "このブラウザでは {missing} の保存データを読めません（localStorage 不可）。分析結果はその分だけ不完全です。",
    missingBuildsLabel: "保存ビルド",
    missingMyTeamLabel: "My Team",
    missingSquadLabel: "スカッド",
    cardsErrorSuffix: "（分析対象は表示を続けています。カード名・画像だけが不足します。）",
    staleNoticeTemplate: "別のタブで{targets}が更新されました。",
    staleBuildLabel: "保存ビルド",
    staleMyTeamLabel: "My Team",
    staleSquadLabel: "スカッド",
    summaryHeading: "全体サマリー",
    statusPrefix: "— 状態: ",
    statusWarning: "注意（問題参照あり）",
    statusNormal: "正常",
    totalBuildsLabel: "保存ビルド総数",
    usedLabel: "使用中",
    unusedLabel: "未使用",
    multiUseLabel: "複数箇所で使用中",
    myTeamSelectedLabel: "My Team で選択中",
    myTeamFavoriteLabel: "My Team のお気に入り",
    squadUsedLabel: "スカッドで使用中",
    currentRulesLabel: "現行規則",
    legacyRulesLabel: "旧規則",
    unknownRulesLabel: "規則不明",
    pomBuildsLabel: "Power of Many 指定あり",
    experimentalBuildsLabel: "実験的試算あり",
    missingMyTeamRefsLabel: "削除済み My Team 参照",
    missingSquadRefsLabel: "削除済みスカッド参照",
    mismatchRefsLabel: "worldCardId 不一致",
    invalidBuildIdRefsLabel: "不正 buildId",
    unknownRefsLabel: "不明参照",
    unitBuildSuffix: "ビルド",
    unitCountSuffix: "件",
    unitSlotSuffix: "枠",
    summaryFootnote:
      "単位: 「ビルド」= 保存ビルド単位・「件」= 正常/問題の参照件数・「枠」= スカッドの枠数。削除済み・worldCardId 不一致の参照は「使用中」に数えません。",
    legacyGuideHeadingTemplate: "旧規則ビルド確認ガイド（{count} ビルド）",
    legacyGuideIntro:
      "旧規則（旧 rulesVersion）で保存されたビルドを確認し、必要なら各自で個別に現行規則へ調整し直すための読み取り専用ガイドです。この画面から旧規則ビルドを自動変換・一括変換・上書き・削除・解除・付け替えすることはありません。既存の旧規則ビルドはそのまま保持されます。「自動移行機能」ではありません。",
    legacyGuideCaution: "注意事項（この画面は読み取り専用です）",
    legacyGuideCautionNotes:
      "旧規則ビルドは現行規則へ自動変換されていません。配分の解釈が現行規則と異なる場合があります。｜この画面から旧規則ビルドを一括変換・上書き・削除・解除・付け替えすることはありません。｜ポイントは保存されている旧 rulesVersion のルールセットで表示しています（現行規則で再計算していません）。",
    legacyStepsHeading: "現行規則で確認し直す手順（各ビルドを個別に）",
    legacyStep1: "下の一覧で旧規則ビルドの配分・rulesVersion・使用状況を確認する。",
    legacyStep2: "各ビルドの「育成で開く」で対象選手の育成タブを開く（旧規則ビルドの配分は自動で読み込まれません）。",
    legacyStep3: "現行規則の状態で配分を確認・調整する。",
    legacyStep4: "既存の旧規則ビルドを上書きせず、新しいビルド名で保存する（「この育成を保存」）。",
    legacyStep5:
      "My Team またはスカッドで、新しく保存したビルドを個別に選び直す（My Team の「保存ビルドを選ぶ」パネル / スカッド編集の「保存ビルドを選ぶ」パネル）。",
    legacyStep6: "旧規則ビルドが不要かどうかは、参照が外れたことを確認してから My Builds で個別に判断する。",
    legacyNote1: "新しいビルドを保存しても、既存の旧規則ビルドはそのまま残ります。",
    legacyNote2: "My Team とスカッドの参照は自動では切り替わりません。手動で選び直してください。",
    legacyNote3: "確認後の管理（名前変更・複製・削除）は My Builds から個別に行えます。",
    legacyUnitFootnote: "単位: 「ビルド」= 保存ビルド単位・「件」= 参照件数・「枠」= スカッドの枠数。",
    showLegacyOnlyButton: "旧規則ビルドだけを表示",
    clearFilterButton: "絞り込みを解除",
    manageInMyBuildsLink: "My Builds で管理",
    perRowGuideNote: "旧規則ビルドの各行（下の一覧）に「選手詳細 / 育成で開く / My Builds で管理 / My Team / 使用中スカッド」の個別導線があります。",
    noLegacyTitle: "旧規則ビルドはありません",
    noLegacyDescription:
      "保存されているビルドは現行規則、規則不明、または保存ビルドなしの状態です。旧規則ビルドが存在しない理由は複数あるため、明示的に移行したとは断定できません。",
    issuesSummaryTemplate: "削除済み・不正な保存ビルド参照（{count} 件）",
    noIssuesLabel: "削除済み・不正な保存ビルド参照はありません。",
    allFilterLabel: "すべて",
    searchIssuesPlaceholder: "スカッド名・buildId・World ID",
    searchIssuesAriaLabel: "問題参照を検索",
    noMatchingIssuesLabel: "条件に一致する問題参照がありません。",
    issuesFootnote:
      "この一覧は確認専用です。参照の解除・付け替え・自動修復は行いません。My Team / 対象スカッド / My Builds で個別に確認・修正してください。",
    searchFilterSortHeading: "検索・絞り込み・並び替え",
    filterActiveLabel: "適用中",
    searchLabel: "検索（ビルド名・選手名・World ID・buildId・スカッド名）",
    searchPlaceholderExample: "メッシ / 決定力型 / 89138556575063 / メイン",
    searchAriaLabel: "保存ビルドを検索",
    usageFilterLabel: "使用状況",
    allOption: "すべて",
    usedOption: "使用中",
    unusedOption: "未使用",
    rulesFilterLabel: "規則",
    currentRulesOption: "現行規則",
    legacyRulesOption: "旧規則",
    unknownRulesOption: "規則不明",
    cardTypeFilterLabel: "カードタイプ",
    registeredPositionFilterLabel: "登録ポジション",
    myTeamSelectedCheckLabel: "My Team で選択中",
    myTeamFavoriteCheckLabel: "My Team のお気に入り",
    squadUsedCheckLabel: "スカッドで使用中",
    multiUseCheckLabel: "複数箇所で使用中",
    pomCheckLabel: "Power of Many 指定あり",
    experimentalCheckLabel: "実験的試算あり",
    problemRefCheckLabel: "問題参照あり",
    sortAriaLabel: "並び替え",
    clearSearchButton: "検索条件を解除",
    showingCountPrefix: "表示中 ",
    showingCountMiddle: " / 全 ",
    showingCountSuffix: " ビルド",
    noResultsTitle: "条件に一致する保存ビルドがありません",
    noResultsDescription: "検索語やフィルターを変えてみてください。",
    usageHeadingTemplate: "使用状況（合計 {count} 参照）",
    myTeamSelectedCountTemplate: "My Team で選択中（{count} 件）",
    myTeamFavoriteCountTemplate: "My Team のお気に入りビルド（{count} 件）",
    squadAreaSuffixTemplate: "（{areas}・squadId {squadId}）",
    starterSlotsTemplate: "先発 {count} 枠",
    benchSlotsTemplate: "ベンチ {count} 枠",
    notUsedLabel: "どこからも参照されていません（未使用）。",
    myTeamLinkLabel: "My Team",
    usedRefTemplate: "使用中 {count} 参照",
    multiUseBadge: "複数箇所",
    mismatchRefTemplate: "worldCardId 不一致参照 {count}",
    starterAreaLabel: "先発",
    benchAreaLabel: "ベンチ",
    squadSourceTemplate: "{area}・{squadName}（{squadId}）・{slot}",
    myTeamSelectedSourceTemplate: "My Team 選択中（teamCardId {teamCardId}）",
    myTeamFavoriteSourceTemplate: "My Team お気に入り（teamCardId {teamCardId}）",
    openSquadLink: "対象スカッドを開く",
    experimentalSuffixTemplate: " / 実験的試算: {value}",
    experimentalYesLabel: "あり",
    experimentalNoLabel: "なし",
  },
  buildAnalysis: {
    analyzeButtonLabel: "このビルドを分析",
    analyzingStatusLabel: "分析中",
    panelHeadingTemplate: "{name} の個別分析",
    closePanelAriaTemplate: "{name} の分析を閉じる",
    normalModeLabel: "通常",
    harshModeLabel: "辛口",
    modeToggleGroupAriaLabel: "評価モードの切り替え",
    pointsHeading: "育成ポイント",
    trainingFocusHeading: "育成方針",
    strongestGrowthHeading: "重点強化領域",
    underinvestedHeading: "相対的に配分が少ない領域",
    strengthsHeading: "長所",
    concernsHeading: "注意点",
    normalReviewHeading: "通常評価",
    harshReviewHeading: "辛口評価",
    improvementHeading: "改善候補",
    comparisonHeading: "同一カードの別ビルド比較",
    limitationsHeading: "分析上の制限",
    confidenceLabel: "分析信頼度",
    confidenceHigh: "高",
    confidenceMedium: "中",
    confidenceLimited: "限定的",
    confidenceUnavailable: "判定不可",
    noStrengthsText: "現時点で明確な長所は確認できません。",
    noConcernsText: "現時点で明確な注意点は確認できません。",
    noSuggestionsText: "現時点で提示できる改善候補はありません。",
    noComparisonText: "同一カードの他の保存ビルドはありません。",
    noLimitationsText: "特筆すべき制限はありません。",
    priorityLabelTemplate: "優先度 {priority}",
    suggestionTargetTemplate: "対象領域: {category}",
    suggestionReasonLabel: "理由: ",
    suggestionRecheckLabel: "再確認すべき点: ",
    suggestionPreserveLabel: "維持すべき長所: ",
    suggestionPreserveNoneText: "特になし",
    improvementSourceIntentLabel: "選択した育成目的に基づく改善候補",
    generalSuggestionsToggleLabel: "一般的な観点の改善候補も見る",
    comparisonUsedPointsMoreTemplate: "現在のビルドは「{other}」より{diff}pt多く使用しています。",
    comparisonUsedPointsLessTemplate: "現在のビルドは「{other}」より{diff}pt少なく使用しています。",
    comparisonUsedPointsSameText: "現在のビルドと「{other}」の使用ポイントは同じです。",
    comparisonRemainingPointsDiffUnknownText: "残りポイント差: 不明",
    comparisonRemainingPointsMoreTemplate: "現在のビルドは「{other}」より残りポイントが{diff}pt多い状態です。",
    comparisonRemainingPointsLessTemplate: "現在のビルドは「{other}」より残りポイントが{diff}pt少ない状態です。",
    comparisonRemainingPointsSameText: "現在のビルドと「{other}」の残りポイントは同じです。",
    comparisonOvrMoreTemplate: "現在のビルドは「{other}」より保存時推定OVRが{diff}高い状態です。",
    comparisonOvrLessTemplate: "現在のビルドは「{other}」より保存時推定OVRが{diff}低い状態です。",
    comparisonOvrSameText: "現在のビルドと「{other}」の保存時推定OVRは同じです。",
    comparisonOvrDiffUnknownText: "保存時推定OVR差: 不明",
    comparisonFocusDifferentTemplate: "育成方針の違い: このビルドは{current}中心、比較先は{other}中心です。",
    comparisonFocusSameText: "育成方針はこのビルドと近い可能性があります。",
    comparisonUsedStatusUsed: "使用中",
    comparisonUsedStatusUnused: "未使用",
    comparisonUpdatedAtTemplate: "更新: {updatedAt}",
    trainingFocusNoneText: "育成配分がまだありません。",
    trainingFocusSingleTemplate: "{category}（Lv.{level}）に集中して育成しています。",
    trainingFocusDominantTemplate: "{category}（Lv.{level}）を中心に、{secondary} にも配分しています。",
    trainingFocusDominantNoSecondaryTemplate: "{category}（Lv.{level}）を中心に育成しています。",
    trainingFocusBalancedTemplate: "特定の領域に偏らず、複数の領域へバランスよく配分しています。",
    strongestGrowthNoneText: "重点的に強化した領域はまだありません。",
    underinvestedNoneText: "相対的に配分が少ない領域は特にありません。",
    completionLabel: "完成状態",
    completionUnallocated: "未着手（育成配分なし）",
    completionInProgress: "育成中",
    completionNearComplete: "ほぼ完成",
    completionComplete: "配分完了",
    completionUnknown: "判定不可（最大レベル情報が不足）",
    findingNoAllocationNormal: "育成ポイントがまだ配分されていません。",
    findingNoAllocationHarsh: "育成ポイントが一切配分されておらず、この保存ビルドはまだ育成の意図を示せていません。",
    findingFocusedPrimaryCategoryNormal: "{category}（Lv.{level}）を重点的に強化する、明確な育成方針です。",
    findingFocusedPrimaryCategoryHarsh: "{category}（Lv.{level}）への一点集中で、他の領域はほぼ手つかずです。用途に合っているか再確認する余地があります。",
    findingBalancedAllocationNormal: "{count} つの領域へバランスよく配分しています。",
    findingBalancedAllocationHarsh: "{count} つの領域へ配分が分かれています。優先したい領域や主な目的が入力されていない現状では、この配分だけで用途の適否を断定することはできません。",
    findingNearFullyAllocated: "残りポイントが少なく、配分がほぼ完成しています。",
    findingManyRemainingPointsNormal: "残りポイントが {remaining}pt あり、まだ配分の余地があります。",
    findingManyRemainingPointsHarsh: "残りポイントを {remaining}pt 残したままで、この配分をまだ完成扱いにするのは早いです。",
    findingUnderinvestedAreaPresentNormal: "{category} への育成配分は相対的に少ないですが、能力値そのものが低いとは限りません。",
    findingUnderinvestedAreaPresentHarsh: "{category} への配分が現状ありません。現在の用途に本当に不要か、再確認する余地があります。",
    findingLegacyOrUnknownRulesNormal: "このビルドは旧規則または規則不明の状態で保存されています。現行規則での再確認をおすすめします。",
    findingLegacyOrUnknownRulesHarsh: "旧規則のまま保存されており、現行規則での再確認が済んでいません。",
    findingReferenceAnomalyNormal: "この保存ビルドを参照している箇所に、データの不一致が見つかっています。詳しくは棚卸し結果をご確認ください。",
    findingReferenceAnomalyHarsh: "この保存ビルドの参照に異常があります。詳細な育成分析より先に、参照の修正を優先してください。",
    findingExperimentalTrialIncluded: "選手ブースターの試算（実験的設定）を含みます。",
    findingPowerOfManyIncluded: "Power of Many の指定はユーザーによる試算値で、ゲーム内で自動検証された値ではありません。",
    findingUniqueVsSiblings: "同一カードの他の保存ビルドにはない、独自の育成方針です。",
    findingOverlapsWithSiblingNormal: "「{siblingName}」と育成方針が近いようです。使い分けを確認しておくと安心です。",
    findingOverlapsWithSiblingHarsh: "「{siblingName}」と育成方針が近く、保存を分けている理由が弱い状態です。",
    findingOverlapsWithSiblingAbilityConfirmedHarsh: "「{siblingName}」とは育成方針と主要な26能力値構成の両方が近く、現在確認できる差だけでは用途を分けて保存する理由が明確ではありません。",
    findingInsufficientData: "カード情報が不足しているため、一部の分析ができません。",
    findingOverAllocatedPoints: "使用ポイントが合計ポイントを超えています（{used} / {total}）。",
    suggestionTitleReferenceAnomaly: "保存ビルド参照の異常を修正する",
    suggestionTitleStartAllocation: "育成配分を設定する",
    suggestionTitleUseRemainingPoints: "残りポイントの使い道を検討する",
    suggestionTitleConsiderUnderinvestedArea: "{category} への配分を検討する",
    suggestionTitleRecheckUnderCurrentRules: "現行規則での再確認",
    suggestionTitleDifferentiateFromSibling: "「{siblingName}」との役割分担を見直す",
    suggestionReasonReferenceAnomaly: "この保存ビルドを参照している箇所に、削除済みまたは不一致のデータが見つかっています。",
    suggestionReasonNoAllocation: "育成ポイントがまだ配分されていません。",
    suggestionReasonManyRemainingPoints: "残りポイントが {remaining}pt あります。",
    suggestionReasonUnderinvestedArea: "{category} への配分が現時点でありません。",
    suggestionReasonLegacyRules: "旧規則または規則不明の状態で保存されています。",
    suggestionReasonOverlapsWithSibling: "「{siblingName}」と育成方針が近い状態です。",
    suggestionRecheckReferenceAnomaly: "保存ビルド分析（Build Analysis）の棚卸し結果で、参照元と保存ビルドの対応を確認してください。",
    suggestionRecheckNoAllocation: "このカードの登録ポジションと現在の能力値を確認し、育成の方向性を検討してください。",
    suggestionRecheckManyRemainingPoints: "残りポイントを使うかどうかは、現在の用途（先発 / 控え / 試算用など）に応じて判断してください。",
    suggestionRecheckUnderinvestedArea: "この領域への配分が現在の用途に必要かどうかを確認してください。",
    suggestionRecheckLegacyRules: "現行規則での配分・ポイント消費が旧規則と異なる場合があるため、再確認してください。",
    suggestionRecheckOverlapsWithSibling: "2つのビルドをどちらも保存し続ける必要があるか、用途の違いを確認してください。",
    findingAbilityGainReflectsFocus: "{category}への配分は、実際に主要な能力向上（合計+{delta}）として現れています。",
    findingAbilityGainHighlight: "最も伸びた能力は{ability}で、育成前から+{delta}上昇しています。",
    findingOverinvestmentCandidateNormal: "{category}は育成前から高い能力（平均{baseAverage}前後）へ重点配分されています。この領域への追加投資が最優先だったかは再確認する余地があります。",
    findingOverinvestmentCandidateHarsh: "{category}は育成前から既に高い能力（平均{baseAverage}前後）へ重点配分されており、この配分が本当に最優先だったのか再確認する余地があります。",
    findingUnderinvestedButHighFinal: "{category}への配分は相対的に少ないですが、現在の最終能力値は平均{finalAverage}前後と高く、能力値そのものが低いとは限りません。",
    findingUnderinvestedAndLowFinal: "{category}への配分は少なく、現在の最終能力値も平均{finalAverage}前後とこのビルド内では低めです。ただし、現在の用途に必要な領域かどうかは別途確認が必要です。",
    findingUnderinvestedContextUnknown: "{category}への配分は少ない状態ですが、能力値データが不足しているため、詳しい状況は判断できません。",
    findingAbilityDataUnavailable: "能力値データを取得できなかったため、能力値に基づく分析は含まれていません。",
    findingAbilityComparisonPracticallySame: "「{siblingName}」とは主要な26能力値の構成も実質的に近い状態です。",
    findingAbilityComparisonDifferentFocus: "「{siblingName}」とは主要な能力値の構成が明確に異なります。",
    suggestionTitleOverinvestmentCandidate: "{category}への配分を再確認する",
    suggestionReasonOverinvestmentCandidate: "育成前から高い能力（平均{baseAverage}前後）へ重点配分されています。",
    suggestionRecheckOverinvestmentCandidate: "この領域への追加投資が、現在の用途にとって最優先だったかを再確認してください。",
    abilityMainEffectsHeading: "能力値への主な効果",
    abilityLargestGainsLabel: "最も伸びた能力",
    abilityHighestFinalLabel: "最終能力値が高い能力",
    abilityNoGainsText: "育成による上昇はまだ確認できません。",
    abilityNoDataText: "能力値データを取得できませんでした。",
    abilityLoadingText: "能力値データを取得しています…",
    abilityBeforeLabel: "育成前",
    abilityTrainedLabel: "育成後（配分のみ）",
    abilityFinalLabel: "最終（保存時点）",
    abilityGainValueTemplate: "+{value}",
    abilityDetailToggleLabel: "26能力値の詳細を見る",
    abilityDetailRowTemplate: "{ability}: {before} → {trained}（育成後） / {final}（最終） 上昇 {delta}",
    abilityComparisonDiffHeading: "別ビルドとの主な能力差",
    abilityComparisonNoDataText: "能力値の比較データがありません。",
    abilityComparisonConditionLegacyText: "旧規則または規則不明のビルドを含むため、単純な比較はできません。",
    abilityComparisonConditionUnallocatedText: "一方が育成配分なしのため、単純な比較はできません。",
    abilityComparisonDiffRowTemplate: "{ability}: 現在 {currentValue} / 比較先 {otherValue}（差 {diff}）",
    intentSectionHeading: "分析目的",
    intentUnsavedNote: "この入力は保存されません（保存ビルド・localStorageには反映されず、画面を離れると消えます）。",
    intentPositionLabel: "使用予定ポジション",
    intentPositionNoneOption: "未指定",
    intentPrimaryGoalLabel: "主な目的",
    intentGroupPrioritiesHeading: "能力領域ごとの優先度",
    intentFieldPlayersHeading: "フィールドプレイヤーの能力領域",
    intentGoalkeepingHeading: "ゴールキーパーの能力領域",
    intentStatePriority: "優先",
    intentStateNormal: "通常",
    intentStateLow: "低優先",
    buildIntentFreeTextLabel: "育成の狙い",
    buildIntentFreeTextDescription: "育成でどうしたいかを自由に書いてください。「育成意図を読み取る」で解析し、内容を確認してから分析へ反映できます(確認するまで評価は変わりません)。",
    buildIntentFreeTextPlaceholder: "例: RWFで使いたい。瞬発力とドリブルを優先し、サイドで1人を剥がせるビルドにしたい。スピードは元から高いので上げすぎなくてよい。シュートは最低限残し、空中戦と守備は重視しない。ビルド2より突破力に寄せたい。",
    intentUserNoteCounterTemplate: "{count} / {max} 文字",
    buildIntentExampleToggleLabel: "入力例を見る",
    buildIntentExampleText: "RWFで使いたい。瞬発力とドリブルを優先し、サイドで1人を剥がせるビルドにしたい。スピードは元から高いので上げすぎなくてよい。シュートは最低限残し、空中戦と守備は重視しない。ビルド2より突破力に寄せたい。",
    buildIntentAnalyzeButtonLabel: "育成意図を読み取る",
    buildIntentAnalyzingLabel: "解析中…",
    buildIntentCancelLabel: "キャンセル",
    buildIntentRetryLabel: "もう一度読み取る",
    buildIntentDiscardLabel: "解析結果を破棄",
    buildIntentConfirmButtonLabel: "この内容で分析",
    buildIntentInterpretationHeading: "入力内容から読み取った育成意図",
    buildIntentStaleNotice: "育成の狙いが変更されています。最新の内容をもう一度読み取ってください。",
    buildIntentNotConfiguredNotice: "育成意図の自動解析は現在利用できません。詳細設定を手動で指定して分析できます。",
    buildIntentFailedNotice: "育成意図を読み取れませんでした。もう一度試すか、詳細設定を手動で指定してください。",
    buildIntentConfirmedNotice: "この評価では、確認済みの育成意図を使用しています。",
    buildIntentManualDetailsToggleLabel: "解析結果を詳細設定で修正",
    buildIntentAvoidOverinvestmentLabel: "上げすぎ注意",
    buildIntentIntentionallyIgnoreLabel: "評価対象外",
    buildIntentComparisonTargetLabel: "比較対象ビルド",
    buildIntentComparisonTargetNoneOption: "未指定",
    buildIntentStrengthsToPreserveLabel: "維持したい長所",
    buildIntentAmbiguitiesHeading: "確認が必要な点",
    buildIntentAmbiguitiesNoneText: "なし",
    buildIntentConfidenceLabel: "解釈の信頼度",
    buildIntentConfidenceHigh: "高",
    buildIntentConfidenceMedium: "中",
    buildIntentConfidenceLow: "低",
    buildIntentInterpPositionLabel: "使用予定ポジション",
    buildIntentInterpGoalLabel: "主目的",
    buildIntentInterpPriorityLabel: "最優先",
    buildIntentInterpSecondaryLabel: "補助的に重視",
    buildIntentInterpAvoidOverinvestmentLabel: "上げすぎたくない",
    buildIntentInterpIgnoredLabel: "今回は評価対象外",
    buildIntentInterpComparisonTargetLabel: "比較したいビルド",
    buildIntentInterpComparisonFocusLabel: "比較で重視する点",
    buildIntentInterpPreserveLabel: "維持したい長所",
    buildIntentInterpNoneValue: "未指定",
    buildIntentReadHeading: "読み取れた内容",
    buildIntentUnspecifiedCollapsedLabel: "その他の項目は未指定",
    buildIntentClarificationHeading: "確認してほしい内容",
    clarificationNoneOptionLabel: "どれにも当てはまらない",
    clarificationNoneOptionDescription: "この候補のどれも選ばず、必要なら下の詳細設定で手動指定してください。",
    buildIntentClarificationPendingNotice: "上の確認事項にすべて回答すると「この内容で分析」を押せるようになります。",
    clarificationCrossRoleQuestion: "「クロス」に関する表現には複数の意味があります。どちらに近いですか?",
    clarificationCrossRoleReason: "クロス関連の表現には、サイドから供給する意味と、クロスに合わせて得点する意味の両方があるため、確認が必要です。",
    clarificationCrossSupplyLabel: "サイドからクロスを供給する側",
    clarificationCrossSupplyDescription: "パス・チャンスメイクを重視する使い方として扱います。",
    clarificationCrossReceiveLabel: "クロスに合わせて得点する側",
    clarificationCrossReceiveDescription: "空中戦・シュートを重視する使い方として扱います。",
    clarificationCrossWideAttackLabel: "サイド攻撃全体を重視したい",
    clarificationCrossWideAttackDescription: "パス・チャンスメイクを中心に、サイドでの攻撃参加を重視する使い方として扱います。",
    clarificationCrossReceiveFocusQuestion: "クロスに合わせる際、どちらをより重視しますか?",
    clarificationCrossReceiveFocusReason: "クロスに合わせる使い方には、空中戦を重視する場合とシュートを重視する場合の両方があるため、確認が必要です。",
    clarificationCrossReceiveAerialLabel: "空中戦を重視したい",
    clarificationCrossReceiveAerialDescription: "エアバトル・ヘディングなど空中戦の能力を重視します。",
    clarificationCrossReceiveShootingLabel: "シュート・決定力を重視したい",
    clarificationCrossReceiveShootingDescription: "シュート・決定力など得点に関わる能力を重視します。",
    clarificationCrossReceiveBothLabel: "両方とも重視したい",
    clarificationCrossReceiveBothDescription: "空中戦とシュートの両方を重視する使い方として扱います。",
    buildIntentUnanalyzedHeading: "読み取れなかった内容",
    buildIntentUnanalyzedIntro: "次の内容は、現在のルールでは安全に判断できませんでした。誤った内容を確定させないため、能力領域などは自動では設定していません。",
    buildIntentUnanalyzedZeroHeading: "入力内容を十分に整理できませんでした",
    buildIntentUnanalyzedZeroBody: "書いていただいた内容から、育成の狙いを安全に読み取れませんでした。下の入力例を参考に書き直すか、詳細設定から直接指定してください。",
    buildIntentManualSettingsHintText: "下の「解析結果を詳細設定で修正」から、ポジションや能力領域を直接指定できます。",
    buildIntentAdditionalExamplesHeading: "追加の入力例",
    buildIntentAdditionalExampleInsertLabel: "この例文を追加する",
    buildIntentAdditionalExampleCrossSupplyLabel: "例: サイドからクロスを供給したい場合",
    buildIntentAdditionalExampleCrossSupplyText: "RWFで使いたい。サイドからクロスを供給したい。パスを最優先にしたい。",
    buildIntentAdditionalExampleCrossReceiveLabel: "例: クロスに合わせて得点したい場合",
    buildIntentAdditionalExampleCrossReceiveText: "CFで使いたい。クロスに合わせて得点したい。空中戦とシュートを最優先にしたい。",
    buildIntentAdditionalExampleCrossAmbiguousLabel: "例: まだ役割を決めていない場合",
    buildIntentAdditionalExampleCrossAmbiguousText: "クロスゲームしたい。",
    presetCategoryScoringTitle: "得点",
    presetCategoryDribblingPossessionTitle: "ドリブル・ボール保持",
    presetCategoryPassingCreationTitle: "パス・チャンスメイク",
    presetCategoryWideCrossingTitle: "サイド・クロス",
    presetCategorySpeedCounterTitle: "スピード・カウンター",
    presetCategoryPhysicalAerialTitle: "フィジカル・空中戦",
    presetCategoryDefendingTitle: "守備",
    presetCategoryGoalkeepingTitle: "GK",
    presetCategoryBalancedAdjustmentTitle: "万能・調整",
    presetTagScoring: "得点",
    presetTagShooting: "シュート",
    presetTagFinisher: "フィニッシャー",
    presetTagBox: "ボックス内",
    presetTagDribbling: "ドリブル",
    presetTagCross: "クロス",
    presetTagAerial: "空中戦",
    presetTagPossession: "ボール保持",
    presetTagCentral: "中央",
    presetTagWide: "サイド",
    presetTagSpeed: "スピード",
    presetTagPassing: "パス",
    presetTagFullback: "サイドバック",
    presetTagDefending: "守備",
    presetTagCounter: "カウンター",
    presetTagPhysical: "フィジカル",
    presetTagTarget: "ターゲット",
    presetTagGoalkeeping: "GK",
    presetTagBalance: "バランス",
    presetScoringSpecialistTitle: "得点特化",
    presetScoringSpecialistShort: "シュート力を最優先にして得点力を高めます。",
    presetScoringSpecialistDetail: "決定力・セットプレー・カーブを含むシュート能力領域を最優先にします。フィニッシュの質そのものを高めたい場合に向いています。",
    presetBoxFinisherTitle: "ボックス内フィニッシャー",
    presetBoxFinisherShort: "シュートを最優先に、クイックネスを補助的に重視します。",
    presetBoxFinisherDetail: "ペナルティエリア内での素早い反応から得点する形を想定し、シュートを最優先、クイックネスを補助的に重視します。",
    presetDribbleToShotTitle: "ドリブルからシュート",
    presetDribbleToShotShort: "シュートを最優先に、ドリブルを補助的に重視します。",
    presetDribbleToShotDetail: "自ら仕掛けてから得点する形を想定し、シュートを最優先、ドリブルを補助的に重視します。",
    presetCrossReceiveScoringTitle: "クロスに合わせて得点",
    presetCrossReceiveScoringShort: "シュートを最優先に、空中戦を補助的に重視します。",
    presetCrossReceiveScoringDetail: "クロスへ合わせて仕留める形を想定し、シュートを最優先、空中戦を補助的に重視します。",
    presetAerialScoringTitle: "空中戦から得点",
    presetAerialScoringShort: "空中戦を最優先に、シュートを補助的に重視します。",
    presetAerialScoringDetail: "競り合いの強さそのものを得点力の中心に据える形を想定し、空中戦を最優先、シュートを補助的に重視します。",
    presetDribbleBreakthroughTitle: "ドリブル突破",
    presetDribbleBreakthroughShort: "ドリブルを最優先にして突破力を高めます。",
    presetDribbleBreakthroughDetail: "ボールコントロール・ドリブル・タイトポゼッションを含むドリブル能力領域を最優先にします。",
    presetBeatOneOnWingTitle: "サイドで1人を剥がす",
    presetBeatOneOnWingShort: "ドリブルを最優先に、クイックネスを補助的に重視します。",
    presetBeatOneOnWingDetail: "サイドの1対1で相手を剥がす形を想定し、ドリブルを最優先、クイックネスを補助的に重視します。",
    presetTightSpacePossessionTitle: "狭い場所でボールを保持",
    presetTightSpacePossessionShort: "ボール保持を主目的に、ドリブルを最優先にします。",
    presetTightSpacePossessionDetail: "主目的をボール保持とし、タイトポゼッションを含むドリブル能力領域を最優先にします。",
    presetHardToDispossessTitle: "ボールを失いにくくする",
    presetHardToDispossessShort: "ボール保持を主目的に、ドリブルを最優先、脚力を補助的に重視します。",
    presetHardToDispossessDetail: "主目的をボール保持とし、ドリブルを最優先、体のバランスを含む脚力領域を補助的に重視します。",
    presetCarryThroughCenterTitle: "中央でボールを運ぶ",
    presetCarryThroughCenterShort: "ドリブルを最優先に、クイックネスを補助的に重視します。",
    presetCarryThroughCenterDetail: "中盤中央でボールを運ぶ形を想定し、ドリブルを最優先、クイックネスを補助的に重視します。",
    presetCutInsideAttackTitle: "カットインから攻撃",
    presetCutInsideAttackShort: "ドリブルを最優先に、シュートを補助的に重視します。",
    presetCutInsideAttackDetail: "サイドから中央へカットインして仕掛ける形を想定し、ドリブルを最優先、シュートを補助的に重視します。",
    presetReceiveAndDistributeTitle: "足元で受けて展開",
    presetReceiveAndDistributeShort: "ボール保持を主目的に、ドリブルを最優先、パスを補助的に重視します。",
    presetReceiveAndDistributeDetail: "足元で受けてから展開する形を想定し、ドリブルを最優先、パスを補助的に重視します。",
    presetQuicknessFocusTitle: "クイックネス重視",
    presetQuicknessFocusShort: "クイックネスを最優先にします。",
    presetQuicknessFocusDetail: "初速・加速力を含むクイックネス能力領域を最優先にします。",
    presetPassingSpecialistTitle: "パス特化",
    presetPassingSpecialistShort: "パスを最優先にしてチャンスメイク力を高めます。",
    presetPassingSpecialistDetail: "グラウンダーパス・フライパス・オフェンスセンスを含むパス能力領域を最優先にします。",
    presetGameMakingTitle: "ゲームメイク",
    presetGameMakingShort: "パスを最優先に、ドリブルを補助的に重視します。",
    presetGameMakingDetail: "攻撃を組み立てる形を想定し、パスを最優先、ドリブルを補助的に重視します。",
    presetForwardServiceTitle: "前線への配球",
    presetForwardServiceShort: "パスを最優先にします。",
    presetForwardServiceDetail: "低い位置から前線へボールを配る形を想定し、パスを最優先にします。",
    presetDistributeTheBallTitle: "ボールを散らす",
    presetDistributeTheBallShort: "パスを最優先に、クイックネスを補助的に重視します。",
    presetDistributeTheBallDetail: "テンポよくボールを散らす形を想定し、パスを最優先、クイックネスを補助的に重視します。",
    presetPossessionAnchorTitle: "ポゼッションの起点",
    presetPossessionAnchorShort: "ボール保持を主目的に、パスを最優先、ドリブルを補助的に重視します。",
    presetPossessionAnchorDetail: "ポゼッションの起点となる形を想定し、パスを最優先、ドリブルを補助的に重視します。",
    presetCrossSupplyTitle: "クロスを供給",
    presetCrossSupplyShort: "パスを最優先にします。",
    presetCrossSupplyDetail: "サイドからクロスを供給する形を想定し、パスを最優先にします。使用予定ポジションの候補にはウイング・サイドハーフ・サイドバックを含みます。",
    presetDribbleThenCrossTitle: "縦突破からクロス",
    presetDribbleThenCrossShort: "パスを最優先に、ドリブルを補助的に重視します。",
    presetDribbleThenCrossDetail: "縦へ突破してからクロスを送る形を想定し、パスを最優先、ドリブルを補助的に重視します。",
    presetWideChanceCreationTitle: "サイドでチャンスメイク",
    presetWideChanceCreationShort: "パスを最優先に、クイックネスを補助的に重視します。",
    presetWideChanceCreationDetail: "サイドからチャンスを作る形を想定し、パスを最優先、クイックネスを補助的に重視します。",
    presetCarryDownLineTitle: "タッチライン際で運ぶ",
    presetCarryDownLineShort: "ドリブルを最優先に、クイックネスを補助的に重視します。",
    presetCarryDownLineDetail: "タッチライン際でボールを運ぶ形を想定し、ドリブルを最優先、クイックネスを補助的に重視します。",
    presetCutInsideShootTitle: "カットインしてシュート",
    presetCutInsideShootShort: "シュートを最優先に、ドリブルを補助的に重視します。",
    presetCutInsideShootDetail: "サイドから中央へカットインして仕留める形を想定し、シュートを最優先、ドリブルを補助的に重視します。",
    presetAttackingFullbackTitle: "攻撃参加するサイドバック",
    presetAttackingFullbackShort: "パスを最優先に、クイックネスを補助的に重視します。",
    presetAttackingFullbackDetail: "サイドバックとして攻撃参加する形を想定し、パスを最優先、クイックネスを補助的に重視します。",
    presetDefensiveFullbackTitle: "守備重視のサイドバック",
    presetDefensiveFullbackShort: "ディフェンスを最優先にします。",
    presetDefensiveFullbackDetail: "サイドバックとして守備を重視する形を想定し、ディフェンスを最優先にします。ポジションだけを根拠に他領域は自動設定しません。",
    presetSpeedBreakthroughTitle: "スピード突破",
    presetSpeedBreakthroughShort: "クイックネスを最優先にします。",
    presetSpeedBreakthroughDetail: "初速・加速力を含むクイックネス能力領域を最優先にします。",
    presetRunInBehindTitle: "裏抜け重視",
    presetRunInBehindShort: "クイックネスを最優先に、シュートを補助的に重視します。",
    presetRunInBehindDetail: "相手の裏へ抜け出す形を想定し、クイックネスを最優先、シュートを補助的に重視します。",
    presetCounterOutletTitle: "カウンター要員",
    presetCounterOutletShort: "カウンターを主目的に、クイックネスを最優先、ドリブルを補助的に重視します。",
    presetCounterOutletDetail: "主目的をカウンターとし、クイックネスを最優先、ドリブルを補助的に重視します。カウンターはチーム戦術に依存するため、保存ビルド単体の分析では参考情報として扱います。",
    presetSprintDownWingTitle: "サイドを駆け上がる",
    presetSprintDownWingShort: "クイックネスを最優先に、パスを補助的に重視します。",
    presetSprintDownWingDetail: "サイドを駆け上がる形を想定し、クイックネスを最優先、パスを補助的に重視します。",
    presetAerialSpecialistTitle: "空中戦特化",
    presetAerialSpecialistShort: "空中戦を最優先にします。",
    presetAerialSpecialistDetail: "ヘディング・ジャンプ力・フィジカルコンタクトを含む空中戦能力領域を最優先にします。",
    presetTargetManTitle: "ターゲット役",
    presetTargetManShort: "空中戦を最優先に、脚力を補助的に重視します。",
    presetTargetManDetail: "前線でターゲットになる形を想定し、空中戦を最優先、脚力を補助的に重視します。",
    presetPostPlayTitle: "ポストプレー",
    presetPostPlayShort: "ボール保持を主目的に、脚力を最優先、ドリブルを補助的に重視します。",
    presetPostPlayDetail: "背負ってボールを収める形を想定し、主目的をボール保持とし、脚力を最優先、ドリブルを補助的に重視します。",
    presetResistPhysicalContactTitle: "当たり負けしにくくする",
    presetResistPhysicalContactShort: "脚力を最優先にします。",
    presetResistPhysicalContactDetail: "キック力・体のバランス・スタミナを含む脚力能力領域を最優先にします。",
    presetBallWinningSpecialistTitle: "ボール奪取特化",
    presetBallWinningSpecialistShort: "ディフェンスを最優先にします。",
    presetBallWinningSpecialistDetail: "守備意識・対人守備・ボール奪取を含むディフェンス能力領域を最優先にします。",
    presetMidfieldDestroyerTitle: "中盤の潰し役",
    presetMidfieldDestroyerShort: "ディフェンスを最優先に、脚力を補助的に重視します。",
    presetMidfieldDestroyerDetail: "中盤で相手の攻撃を潰す形を想定し、ディフェンスを最優先、脚力を補助的に重視します。",
    presetManMarkingFocusTitle: "対人守備重視",
    presetManMarkingFocusShort: "ディフェンスを最優先に、クイックネスを補助的に重視します。",
    presetManMarkingFocusDetail: "1対1の守備に強くなる形を想定し、ディフェンスを最優先、クイックネスを補助的に重視します。",
    presetBacklineStabilityTitle: "最終ラインの安定",
    presetBacklineStabilityShort: "ディフェンスを最優先に、空中戦を補助的に重視します。",
    presetBacklineStabilityDetail: "最終ラインの安定を想定し、ディフェンスを最優先、空中戦を補助的に重視します。",
    presetShotStoppingFocusTitle: "シュートストップ重視",
    presetShotStoppingFocusShort: "GK1(反応)を最優先にします。",
    presetShotStoppingFocusDetail: "GKセンス・コラプシングを含むGK1能力領域を最優先にします。既存のPrimaryGoalIdにGK専用の目的がないため、主目的は参考表示(other)として扱います。",
    presetHighBallFocusTitle: "ハイボール対応",
    presetHighBallFocusShort: "GK3(到達範囲)を最優先にします。",
    presetHighBallFocusDetail: "クリアリングを含むGK3能力領域を最優先にします。主目的は参考表示(other)として扱います。",
    presetCatchingFocusTitle: "キャッチ重視",
    presetCatchingFocusShort: "GK2(キャッチング)を最優先にします。",
    presetCatchingFocusDetail: "キャッチング・クリアリングを含むGK2能力領域を最優先にします。主目的は参考表示(other)として扱います。",
    presetSweeperKeeperTitle: "飛び出し重視",
    presetSweeperKeeperShort: "GK1を最優先に、GK3を補助的に重視します。",
    presetSweeperKeeperDetail: "積極的に飛び出す形を想定し、GK1を最優先、GK3を補助的に重視します。主目的は参考表示(other)として扱います。",
    presetDistributingGkTitle: "配球も重視するGK",
    presetDistributingGkShort: "パスを最優先に、GK1を補助的に重視します。",
    presetDistributingGkDetail: "配球にも関わる形を想定し、パスを最優先、GK1を補助的に重視します。",
    presetBalancedTypeTitle: "バランス型",
    presetBalancedTypeShort: "特定の領域に偏らず、バランスよく配分したい場合に選びます。",
    presetBalancedTypeDetail: "特定の能力領域を最優先にせず、主目的をバランス型として扱います。",
    presetAttackLeaningBalanceTitle: "攻撃寄り万能型",
    presetAttackLeaningBalanceShort: "主目的はバランス型のまま、シュートとドリブルを補助的に重視します。",
    presetAttackLeaningBalanceDetail: "主目的をバランス型としつつ、シュートとドリブルを補助的に重視します。",
    presetDefenseLeaningBalanceTitle: "守備寄り万能型",
    presetDefenseLeaningBalanceShort: "主目的はバランス型のまま、ディフェンスと空中戦を補助的に重視します。",
    presetDefenseLeaningBalanceDetail: "主目的をバランス型としつつ、ディフェンスと空中戦を補助的に重視します。",
    presetSectionHeading: "育成目的",
    presetSearchLabel: "目的を検索",
    presetSearchPlaceholder: "例: クロス、ドリブル、守備",
    presetSearchNoResults: "該当する育成目的が見つかりませんでした。カテゴリから選ぶか、詳細設定を使用してください。",
    presetRecommendedHeading: "おすすめの目的",
    presetCategoryFilterLabel: "カテゴリで絞り込む",
    presetCategoryAllLabel: "すべて",
    presetPrimaryAbilityAreasLabel: "主に確認する能力領域",
    presetMainSelectLabel: "メイン目的として選択",
    presetMainSelectedBadge: "メイン目的",
    presetSubSelectLabel: "サブ目的として選択",
    presetSubSelectedBadge: "サブ目的",
    presetSubMaxReachedNotice: "サブ目的は最大2件まで選択できます。",
    presetClearSelectionLabel: "選択を解除",
    presetPreviewHeading: "設定プレビュー",
    presetPreviewMainLabel: "選択した育成目的",
    presetPreviewSubLabel: "選択したサブ目的",
    presetPreviewNoneSelectedText: "未選択",
    presetPreviewDerivedHeading: "この目的から設定される内容",
    presetSourcePresetLabel: "プリセットから設定",
    presetSourceUserLabel: "ユーザーが変更",
    presetSourceUnspecifiedLabel: "未指定",
    presetDetailSettingsToggleLabel: "目的から作成された設定を調整",
    presetResetToPresetDefaultsLabel: "目的の初期設定へ戻す",
    presetDiscardManualEditsLabel: "すべての詳細修正を破棄",
    presetConflictHeading: "選択した目的と詳細設定が競合しています",
    presetConflictTargetLabel: "対象",
    presetConflictMainGoalLabel: "選択した目的",
    presetConflictManualSettingLabel: "詳細設定",
    presetConflictUsePresetLabel: "目的の設定を使用",
    presetConflictUseManualLabel: "手動設定を使用",
    presetConflictEditManualLabel: "詳細設定で修正",
    presetConflictBlocksConfirmNotice: "競合が解決されるまで「この目的で分析」を確定できません。",
    presetConfirmButtonLabel: "この目的で分析",
    presetConfirmedNoticeHeading: "選択した育成目的を分析に使用しています。",
    presetConfirmedMainLabel: "選択した育成目的",
    presetConfirmedSubLabel: "サブ目的",
    presetConfirmedUserModifiedLabel: "ユーザー修正",
    presetConfirmedUserModifiedYes: "あり",
    presetConfirmedUserModifiedNo: "なし",
    presetReturnToGeneralAnalysisLabel: "一般分析へ戻す",
    presetChangeIntentButtonLabel: "目的を変更",
    presetChangedNotConfirmedNotice: "育成目的が変更されています。現在の評価には、前回確定した目的が使用されています。",
    presetChangedCurrentSelectionLabel: "現在選択中の目的",
    presetChangedInUseLabel: "評価に使用中の目的",
    presetAnalyzeWithNewLabel: "新しい目的で分析",
    presetRevertToPreviousLabel: "前回確定した目的へ戻す",
    presetDetailChangedNotice: "詳細設定が変更されています。新しい設定を評価へ反映してください。",
    presetAnalyzeWithChangedSettingsLabel: "変更した設定で分析",
    presetRevertDetailChangesLabel: "変更前へ戻す",
    presetDeselectedNotice: "育成目的の選択が解除されています。一般分析のみへ戻すには更新してください。",
    presetKeepPreviousSelectionLabel: "前回の目的を維持",
    presetReflectionHeading: "分析へ使用中の設定",
    presetReflectionSourceLabel: "設定元",
    presetReflectionSourcePresetPlusUser: "目的プリセット＋ユーザー修正",
    presetReflectionSourcePresetOnly: "目的プリセットのみ",
    presetReflectionSourceManualOnly: "手動設定のみ",
    presetReflectionSourceNone: "未設定",
    presetReflectionStatusLabel: "状態",
    presetReflectionStatusConfirmed: "確定済み",
    presetReflectionUnconfirmedNotice: "未確定の変更があります",
    presetReflectionUnconfirmedMainChange: "メイン目的",
    presetReflectionUnconfirmedDetailChange: "詳細設定",
    presetCarriedOverNotice: "同じカードの別ビルドへ育成目的を引き継いでいます。",
    buildIntentStatusNotInputText: "未入力",
    buildIntentStatusNotAnalyzedText: "未解析",
    buildIntentStatusAnalyzingText: "解析中",
    buildIntentStatusAwaitingConfirmationText: "確認待ち",
    buildIntentStatusConfirmedText: "確定済み",
    buildIntentStatusStaleText: "入力変更により古い",
    buildIntentStatusFailedText: "解析失敗",
    buildIntentStatusNotConfiguredText: "解析未設定",
    buildIntentStatusManualText: "手動設定を使用",
    intentGoalUnspecified: "未指定",
    intentGoalScoring: "得点力",
    intentGoalDribbling: "ドリブル突破",
    intentGoalPassing: "パス／チャンスメイク",
    intentGoalSpeed: "スピード",
    intentGoalPossession: "ボール保持",
    intentGoalPhysical: "フィジカル",
    intentGoalAerial: "空中戦",
    intentGoalDefense: "守備",
    intentGoalPress: "プレス",
    intentGoalCounter: "カウンター",
    intentGoalBalance: "バランス",
    intentGoalOther: "その他",
    intentReflectionHeading: "入力内容の反映状況",
    intentReflectionUnspecifiedToggleLabel: "その他の未指定項目を見る",
    intentReflectionFieldPrimaryGoal: "分析上の中心目的",
    intentReflectionFieldPosition: "使用予定ポジション",
    intentReflectionFieldPriorityGroups: "優先領域",
    intentReflectionFieldLowerPriorityGroups: "低優先領域",
    intentReflectionFieldAvoidOverinvestmentGroups: "上げすぎたくない領域",
    intentReflectionFieldIntentionallyIgnoredGroups: "今回は評価対象外の領域",
    intentReflectionFieldComparisonTarget: "比較意図",
    intentReflectionFieldFreeText: "育成の狙い",
    intentReflectionFieldStrengthsToPreserve: "維持したい長所",
    intentReflectionStatusUsed: "分析に使用",
    intentReflectionStatusReferenceOnly: "参考情報のみ",
    intentReflectionStatusDisplayOnly: "表示のみ、分析対象外",
    intentReflectionStatusNotSpecified: "未指定",
    intentReflectionStatusLimitedByData: "情報不足により限定的",
    intentAlignmentLabel: "目的適合状態",
    intentAlignmentHigh: "高い",
    intentAlignmentMostlyAligned: "おおむね一致",
    intentAlignmentPartiallyAligned: "一部不一致",
    intentAlignmentPoorlyAligned: "目的とのずれが大きい",
    intentAlignmentInsufficientInformation: "情報不足",
    generalEvaluationHeading: "育成配分そのものの評価",
    intentEvaluationHeading: "入力した目的に対する評価",
    intentEvaluationEmptyGuidance: "主な目的または優先領域を入力すると、目的に対する評価を確認できます。",
    intentConclusionHeading: "結論",
    intentAlignedHeading: "目的と一致している成果",
    intentMisalignmentHeading: "目的との明確な不一致",
    intentOverinvestmentHeading: "目的に対する過剰配分の候補",
    intentAcceptableLowHeading: "今回の用途では問題になりにくい領域",
    intentNotAProblemHeading: "今回の用途では問題として扱わない領域",
    intentComparisonHeading: "同一カードの別ビルドとの目的適合",
    intentImprovementHeading: "目的達成のための改善優先順位",
    intentFinalHeading: "最終判断",
    intentNoneText: "該当なし",
    buildIntentEvidenceHeading: "根拠となった自由文",
    intentContextTemplate: "{goal}を狙ったビルド",
    intentContextWithPositionTemplate: "{position}での{goal}を狙ったビルド",
    intentConclusionWithIssueTemplate: "結論：{context}ですが、{issue}",
    intentConclusionNoIssueTemplate: "結論：{context}で、優先領域への配分はおおむね目的と一致しています。",
    intentConclusionIssueNotReflectedTemplate: "主目的に関わる{category}への配分が反映されていません。",
    intentConclusionIssueUnderprioritizedTemplate: "主目的に関わる{category}への配分が、他の優先領域より弱くなっています。",
    intentConclusionIssueAvoidOverinvestmentTemplate: "上げすぎたくないと指定した{category}への配分が大きくなっています。",
    intentConclusionIssueOverinvestmentTemplate: "優先していない{category}への配分が大きくなっています。",
    intentConclusionAlignmentHigh: "配分の優先順位は目的とよく一致しています。",
    intentConclusionAlignmentMostlyAligned: "配分の優先順位はおおむね目的と一致しています。",
    intentConclusionAlignmentPartiallyAligned: "配分の優先順位は完全には一致していません。",
    intentConclusionAlignmentPoorlyAligned: "配分の優先順位は目的と大きくずれています。",
    intentConclusionAlignmentInsufficientInformation: "現在のデータでは、配分の優先順位が目的と十分に一致しているか判断できません。",
    intentConclusionAlignmentAndImprovementTemplate: "{alignment}最優先の改善候補は{category}です。",
    intentAlignedGroupStronglyWithAbilitiesTemplate: "{categories}は優先領域として指定され、{abilityList}など関連能力が実際に上昇しており、目的とよく一致しています。",
    intentAlignedGroupStronglyTemplate: "{categories}は優先領域として指定され、配分どおりに強化されており、目的とよく一致しています。",
    intentAlignedGroupMostlyWithAbilitiesTemplate: "{categories}は優先領域として指定され、{abilityList}など関連能力にも実際の上昇が確認できるため、目的とおおむね一致しています。",
    intentAlignedGroupMostlyTemplate: "{categories}は優先領域として指定され、目的とおおむね一致しています。",
    intentAlignedNoneText: "現時点で目的と明確に一致していると言い切れる優先領域はありません。",
    intentMisalignmentNoneText: "現時点で目的から大きく外れている配分は見当たりません。",
    intentNotAProblemNoneText: "低優先に指定された領域はありません。",
    intentAbilityDeltaItemTemplate: "{ability}{delta}",
    intentAbilityListSeparator: "、",
    intentFindingPriorityNotReflected: "優先したいと指定した{category}へは、現在配分がありません。目的に対して優先順位が一致しているか確認してください。",
    intentFindingPriorityUnderprioritized: "優先したい{category}への配分はありますが、他の優先領域より少なく、目的の主軸として扱うには弱い状態です。",
    intentFindingPriorityInsufficientData: "{category}への配分は確認できますが、能力値データが不足しているため、目的との一致状態は判断できません。",
    intentFindingPrimaryGoalReflected: "バランス重視の目的に対して、配分は特定の領域へ偏っていません。",
    intentFindingPrimaryGoalMismatch: "バランス重視の目的に対して、{category}への配分が突出しています。",
    intentFindingLowerPriorityLowAllocationGood: "{category}への配分は少ないですが、今回の目的では優先度を下げてもよい領域として指定されているため、主要な問題としては扱いません。",
    intentAcceptableLowOnlyTemplate: "{categories}は低優先に指定されているため、今回の用途では主要な問題として扱いません。",
    intentAcceptableExcludedOnlyTemplate: "{categories}は今回の目的では評価対象外に指定されているため、これらの低い配分は主要な問題として扱いません。",
    intentAcceptableLowAndExcludedTemplate: "{lowCategories}は低優先に指定されています。{excludedCategories}は今回の目的では評価対象外に指定されているため、これらの低い配分は主要な問題として扱いません。",
    intentFindingNearComplete: "目的に沿った配分は、残りポイントが少なくほぼ完成しています。",
    intentFindingSpreadNotAProblem: "{count}領域へ配分が及んでいますが、優先領域への配分が中心のため、目的の不明確さを示すものではありません。",
    intentFindingOverinvestmentOutsidePriorityNormal: "優先していない{category}（特に{ability}）への配分割合が大きくなっています。この配分が目的より優先されるべきか再確認する余地があります。",
    intentFindingOverinvestmentOutsidePriorityHarsh: "{category}は今回の優先領域ではないにもかかわらず、{ability}を含む関連能力が育成前から高く（平均{baseAverage}前後）、そこへさらに大きく配分されています。この配分が目的に対して本当に必要か再確認する余地があります。",
    intentFindingGoalAuxiliaryOnly: "プレス／カウンターは、保存ビルド単体の能力値だけでは判定範囲が限定されます。この分析は補助的な参考情報として扱ってください。",
    intentFindingInsufficientAbilityData: "能力値データが不足しているため、目的適合の判定は限定的です。",
    intentFindingPriorityCountMany: "優先領域が{count}件と多いため、特定の目的に絞った評価は限定的になります。",
    intentFindingPriorityCountAll: "すべての能力領域が優先に指定されているため、目的別の優先順位を判定できません。",
    intentFindingLowerPriorityCountMost: "低優先領域が{count}件と多いため、優先領域を判断する材料が不足しています。",
    intentComparisonCurrentCloserTemplate: "現在のビルドは、「{siblingName}」より今回の目的に近い可能性があります。",
    intentComparisonCurrentCloserDetailedTemplate: "現在のビルドは、「{siblingName}」より{abilityList}を含む優先領域の能力が高く、今回の目的に近い可能性があります。",
    intentComparisonOtherCloserTemplate: "「{siblingName}」の方が、今回の目的に近い可能性があります。",
    intentComparisonOtherCloserDetailedTemplate: "「{siblingName}」の方が、{abilityList}を含む優先領域の能力が高く、今回の目的に近い可能性があります。",
    intentComparisonSimilarTemplate: "「{siblingName}」との差は小さく、どちらが目的に近いかは明確に判断できません。",
    intentComparisonSimilarWithGroupsTemplate: "「{siblingName}」とは{categories}関連の最終能力差が小さく、{goal}型としての差別化はまだ不十分です。優先領域のどこで差を作るかを明確にする必要があります。",
    intentComparisonConditionDiffersTemplate: "「{siblingName}」とは比較条件が異なるため、目的適合の単純な比較はできません。",
    intentComparisonInsufficientDataTemplate: "「{siblingName}」との能力値データが不足しているため、目的適合の比較はできません。",
    intentTopIssueNotReflectedTemplate: "最優先は、優先指定した{category}へ実際に配分することです。",
    intentTopIssueUnderprioritizedTemplate: "最優先は{category}への配分を再確認し、他の優先領域に見劣りしない主軸として扱える配分になっているか見直すことです。",
    intentTopIssueAvoidOverinvestmentTemplate: "最優先は、上げすぎたくないと指定した{category}への配分を抑えることです。",
    intentTopIssueOverinvestmentTemplate: "最優先は{category}への配分を再確認することです。",
    intentTopIssueNoneTemplate: "現状の配分で大きな見直しは必要ありません。",
    intentPreserveTemplate: "{category}で得られている能力上昇は、このビルドの長所として維持してください。",
    intentPreserveNoneTemplate: "維持すべき突出した長所は、現時点では明確ではありません。",
    intentStateSecondary: "補助的に重視",
    buildIntentStatusConfirmedModifiedText: "解析結果を修正した内容を使用中",
    intentReflectionFieldSecondaryPriorityGroups: "補助的な優先領域",
    intentConclusionIssueSecondaryNotReflectedTemplate: "補助的に重視するはずの{category}への配分が反映されていません。",
    intentConclusionIssuePriorityInversionTemplate: "補助的に重視する{category}への配分が、最優先領域の配分を上回っています。",
    intentTopIssueSecondaryNotReflectedTemplate: "次の課題は、補助的に重視する{category}への配分を検討することです。",
    intentTopIssuePriorityInversionTemplate: "最優先は、補助的に重視する{category}への配分を見直し、最優先領域とのバランスを再確認することです。",
    intentFindingSecondaryNotReflected: "{category}を補助的に重視する意図が入力されていますが、現在の配分では反映されていません。",
    intentFindingSecondaryPriorityInversion: "補助的に重視する{category}への配分({level})が、最優先領域の配分({maxLevel})を上回っています。目的との優先順位を再確認してください。",
    intentFindingSecondaryPriorityInversionReview: "補助的に重視する{category}への配分({level})が、最優先領域の配分({maxLevel})をわずかに上回っています。最優先領域にも能力上昇が確認できているため、明確な不一致とは断定しません。配分が意図どおりか確認してください。",
    intentConfirmationHeading: "優先順位の確認事項",
    intentSecondaryHeading: "補助的優先領域の成果",
    intentSecondaryAlignedWithAbilitiesTemplate: "{categories}は補助的に重視する領域として指定されており、{abilityList}の上昇が確認できます。主目的ではありませんが、意図に沿った副次的な成果です。",
    intentSecondaryAlignedTemplate: "{categories}は補助的に重視する領域として配分されています。",
    intentSecondaryInsufficientDataTemplate: "{categories}を補助的に重視する意図は確認できますが、能力値データが不足しているため成果を確認できません。",
    intentPreserveSecondaryTemplate: "{category}は補助的な長所として、意図に沿った成果が確認できます。",
    intentPreserveUnconfirmedTemplate: "{category}を維持したいという意図は確認できますが、現在の能力値データだけでは、この領域が明確な長所として成立しているとは断定できません。",
    buildIntentManualNotice: "詳細設定を手動で指定した内容を分析に使用しています。",
    buildIntentConfirmedModifiedNotice: "この評価では、解析結果を修正した内容を分析に使用しています。",
    buildIntentStaleUsingPreviousNotice: "現在の評価は、以前に確定した育成意図に基づいています。最新の自由記述はまだ反映されていません。",
    intentReflectionSourceLabel: "分析へ使用中の情報源",
    buildIntentSourceAiConfirmedLabel: "確認済みの解析結果",
    buildIntentSourceAiModifiedLabel: "解析結果をユーザーが修正",
    buildIntentSourceManualLabel: "完全な手動設定",
    buildIntentSourceStaleLabel: "古い解析結果",
    buildIntentSourceNotConfiguredLabel: "自動解析未設定",
    buildIntentSourceGeneralOnlyLabel: "一般分析のみ",
    buildIntentMethodNotice: "標準解析(ルールベース) — 外部AIサービスへは送信されません。追加のAI利用料もかかりません。",
    comparisonSummaryHeading: "比較要約",
    comparisonTargetBadgeLabel: "比較対象として指定",
    comparisonTargetNotFoundText: "比較対象として指定したビルドが見つかりません。削除されたか、別のカードのビルドの可能性があります。",
    comparisonDetailsToggleLabel: "比較の詳細を見る",
    comparisonPurposeClosenessLabel: "用途の近さ",
    comparisonPurposeDiffLabel: "目的領域の差",
    comparisonMajorDiffLabel: "主な差",
    comparisonDifferentiationLabel: "差別化",
    comparisonRecommendationLabel: "推奨",
    comparisonOverallSimilarityLabel: "全体の近さ",
    comparisonPurposeSimilaritySamePurposeText: "かなり近い",
    comparisonPurposeSimilarityClosePurposeText: "おおむね近い",
    comparisonPurposeSimilarityDifferentPurposeText: "明確に異なる",
    comparisonPurposeSimilarityNotSetText: "目的未設定のため判定不可",
    comparisonPurposeSimilarityUnknownText: "判定できません",
    comparisonPurposeDiffVerySmallText: "非常に小さい",
    comparisonPurposeDiffSmallText: "小さい",
    comparisonPurposeDiffSomeText: "一部に差がある",
    comparisonPurposeDiffClearText: "明確な差がある",
    comparisonPurposeDiffInsufficientDataText: "データ不足",
    comparisonDifferentiationWellText: "目的に沿った違いが明確",
    comparisonDifferentiationPartialText: "一部に違いがある",
    comparisonDifferentiationLimitedText: "差別化は限定的",
    comparisonDifferentiationNotAssessableText: "判定できない",
    comparisonOverallVerySimilarText: "非常によく似ている",
    comparisonOverallSimilarText: "似ている",
    comparisonOverallPartiallyDifferentText: "一部が異なる",
    comparisonOverallClearlyDifferentText: "明確に異なる",
    comparisonOverallUnknownText: "確認できません",
    comparisonGeneralOnlyNoticeText: "育成目的が設定されていないため、今回は能力構成全体を比較しています。",
    comparisonInsufficientAbilityDataText: "必要な能力値データが不足しているため、このビルドとは比較できません。",
    comparisonPartiallyComparableGeneralOnlyText: "この組み合わせでは目的適合の詳細比較はできません。能力値構成の一般比較のみ表示します。",
    comparisonMajorDiffCurrentHigherTemplate: "{ability}: 現在のビルドが+{diff}高い",
    comparisonMajorDiffOtherHigherTemplate: "{ability}: 比較対象が+{diff}高い",
    comparisonNoMajorDiffText: "目的に関わる能力はほぼ同水準です。",
    comparisonRecommendationMaintainText: "現在の役割分担を維持して問題ありません。",
    comparisonRecommendationDifferentiateTemplate: "{category}での差別化を検討してください。",
    comparisonRecommendationSetPurposeText: "この組み合わせの目的比較を確認するには、比較対象の設定を確認してください。",
    comparisonRecommendationInsufficientDataText: "能力値データが不足しているため、推奨は表示できません。",
    comparisonRecommendationNotComparableText: "比較できないため、推奨は表示できません。",
    comparisonRecommendationGeneralOnlyText: "育成目的を設定すると、目的に沿った比較・推奨を表示できます。",
    comparisonDetailUsedPointsLabel: "使用ポイント",
    comparisonDetailRemainingPointsLabel: "残りポイント",
    comparisonDetailOvrLabel: "保存時推定OVR",
    comparisonDetailAllocationDiffLabel: "育成配分の差",
    comparisonDetailAbilityDiffLabel: "最終能力値の差",
    comparisonDetailCurrentHigherLabel: "現在のビルドが高い能力",
    comparisonDetailOtherHigherLabel: "比較対象が高い能力",
    comparisonDetailNoDiffText: "差はありません",
    comparisonDetailLimitationsLabel: "比較上の制限",
    diagnosisCardHeading: "診断結果カード",
    diagnosisCardShowLabel: "カードを表示",
    diagnosisCardHideLabel: "カードを閉じる",
    diagnosisCardGuidanceNoIntentText: "育成目的を確定すると、目的別の診断結果カードを表示できます。",
    diagnosisCardPendingChangesNotice: "未確定の変更があります。このカードは前回確定した設定に基づいています。",
    diagnosisCardAlignmentLabel: "目的適合状態",
    diagnosisCardAlignmentHighText: "十分に一致",
    diagnosisCardAlignmentMostlyText: "おおむね一致",
    diagnosisCardAlignmentPartiallyText: "一部不一致",
    diagnosisCardAlignmentPoorlyText: "明確な不一致",
    diagnosisCardAlignmentAbilityDataText: "能力データ不足",
    diagnosisCardAlignmentNeedsConfirmationText: "確認が必要",
    diagnosisCardHeadlineInsufficientAbilityDataTemplate: "{goal}型としての目的適合は、能力値データが不足しているため確認できません。",
    diagnosisCardHeadlineWellAlignedNormalTemplate: "{goal}の狙いは能力構成へ反映されています。",
    diagnosisCardHeadlineWellAlignedHarshTemplate: "{goal}型としての配分は、目的とよく一致しています。",
    diagnosisCardHeadlineWellAlignedImprovementNormalTemplate: "{goal}の狙いはおおむね反映されていますが、{category}に確認したい点があります。",
    diagnosisCardHeadlineWellAlignedImprovementHarshTemplate: "{goal}型としてはおおむね一致していますが、{category}への配分を再確認する余地があります。",
    diagnosisCardHeadlineClearIssueNormalTemplate: "{goal}の狙いに対して、{category}への配分を見直す余地があります。",
    diagnosisCardHeadlineClearIssueHarshTemplate: "{goal}型としては、{category}への配分を再確認する余地があります。",
    diagnosisCardHeadlineConfirmationNormalTemplate: "{goal}の狙いに対して、{category}の配分が意図どおりか確認してください。",
    diagnosisCardHeadlineConfirmationHarshTemplate: "{goal}型としては、{category}の配分が意図どおりか確認が必要です。",
    diagnosisCardHeadlineNeedsReviewNormalTemplate: "{goal}の狙いに対する配分を、あらためて見直す余地があります。",
    diagnosisCardHeadlineNeedsReviewHarshTemplate: "{goal}型としては、配分全体を再確認する余地があります。",
    achievementsHeading: "主な成果",
    diagnosisCardNoAchievementsText: "現時点で目的に沿った明確な成果は確認できていません。",
    concernHeading: "最大の注意点",
    diagnosisCardConcernInsufficientDataText: "能力値データが不足しているため、一部の目的適合を確認できません。",
    diagnosisCardConcernNoneText: "大きな目的上の問題は確認されていません。",
    preserveHighlightHeading: "維持する長所",
    diagnosisCardPreserveUnconfirmedText: "維持したい意図はありますが、現在の能力値だけでは明確な長所として確認できません。",
    imageSaveButtonLabel: "画像として保存",
    imageSaveButtonAriaLabel: "診断結果を画像として保存",
    imagePreviewHeading: "画像プレビュー",
    imageOrientationLabel: "画像の向き",
    imageOrientationPortraitLabel: "縦長",
    imageOrientationLandscapeLabel: "横長",
    imageModeGroupAriaLabel: "画像の通常/辛口切り替え",
    imageSaveConfirmLabel: "PNGを保存",
    imageGeneratingText: "画像を生成しています",
    imageSuccessText: "PNG画像を保存しました",
    imageFailedText: "画像を生成できませんでした。もう一度お試しください。",
    imagePendingChangesBlockedText: "変更した設定で分析してから画像を保存してください。",
    imageNormalDiagnosisLabel: "通常診断",
    imageHarshDiagnosisLabel: "辛口診断",
    imageFooterText: "確定済みの設定に基づく分析結果です。",
    savedIntentHeading: "保存状態",
    savedIntentStatusSaved: "保存済み",
    savedIntentStatusUnsaved: "未保存",
    savedIntentSaveGroupAriaLabel: "育成目的の保存操作",
    savedIntentSavingText: "保存しています…",
    savedIntentSaveButtonLabel: "育成目的を保存",
    savedIntentUpdateButtonLabel: "保存した目的を更新",
    savedIntentRevertToSavedLabel: "保存済み設定へ戻す",
    savedIntentDeleteConfirmText: "このビルドに保存した育成目的を削除します。育成配分や保存ビルド本体は削除されません。",
    savedIntentDeleteOnlyLabel: "育成目的だけを削除",
    savedIntentDeleteCancelLabel: "キャンセル",
    savedIntentDeletingText: "削除しています…",
    savedIntentDeleteButtonLabel: "保存した目的を削除",
    savedIntentUnsavedNoticeText: "この育成目的はまだ保存されていません。",
    savedIntentNoConfirmedIntentText: "育成目的を確定すると保存できます。",
    savedIntentUpToDateText: "保存済みの育成目的を使用しています。",
    savedIntentDivergedText: "現在の分析設定は、保存済みの育成目的と異なります。",
    savedIntentPendingChangesText: "未確定の変更があります。保存する前に「この目的で分析」を押してください。",
    savedIntentSaveSuccessText: "育成目的を保存しました。",
    savedIntentSaveFailedText: "育成目的を保存できませんでした。もう一度お試しください。",
    savedIntentDeleteFailedText: "育成目的を削除できませんでした。もう一度お試しください。",
    savedIntentPresetUnresolvedText: "以前保存した育成目的プリセットを確認できません。保存されている詳細設定だけを復元しました。",
    savedIntentComparisonTargetMissingText: "保存されていた比較対象が見つからないため、比較対象なしで復元しました。",
  },
  worldPlayerSearchCard: {
    disabledAriaTemplate: "{name}（{identity}）は{reason}",
    enabledAriaTemplate: "{name}（{identity}）を{action}",
    cannotAddFallback: "追加できません",
    ovrTooltip: "保存済みのカード全体 OVR（ポジション別ではありません）",
    noEnglishName: "（英語名なし）",
    maxOvrLabel: "最大 {value}",
    levelCapLabel: "Lv上限 {value}",
    noTeamInfo: "チーム / 国籍 情報なし",
    pomTooltip: "Power of Many（金色・Game Plan 依存・どのモードでも標準値へ自動適用しません）",
    fixedProvisionalTooltip:
      "固定型（推定）: 効果内容は外部照合済み。Power of Many である具体的証拠が無いため固定型と推定して標準値へ暫定適用しています。",
    fixedTooltip: "固定型（青色・標準モードで標準値へ適用）",
    unresolvedTooltip: "発動方式・効果を確認できていない付属ブースター（標準値へ加算しません）",
    pomChipTemplate: "Power of Many {nameEn} 最大+{level}",
    fixedProvisionalChipTemplate: "{nameEn} +{level}（固定型推定）",
    fixedChipTemplate: "{nameEn} +{level}（固定型）",
    unresolvedChip: "未解決ブースター",
    noAttachedBoosters: "付属ブースターなし",
    detailLink: "詳細",
    detailNewTabSuffix: "（新規タブ）",
    unknownCardType: "カードタイプ不明",
    unknownPosition: "ポジション不明",
    maxOvrTemplate: "最大OVR {value}",
    noOvrInfoLabel: "OVR 情報なし",
    cardImageAltTemplate: "{name} {cardType} カード画像",
  },
  addPlayerSearch: {
    selectCardHeadingTemplate: "{slot}に追加するカードを選択",
    closeButton: "閉じる",
    maxPlayersNoteTemplate: "比較は最大 {max} 人です。追加するには先に選手を削除してください。",
    searchPlaceholder: "選手名・World ID・ポジションで検索...",
    searchAriaLabelTemplate: "{slot}に追加する選手を検索",
    duplicateNote: "同じカード（World ID 一致）は重複追加できません。同一人物でも別カード（World ID 違い）は比較できます。並び: 名前一致 → 最大 OVR 高い順。",
    minLengthPromptTemplate: "選手名・World ID・ポジションを入力してください（{min} 文字以上）。",
    tooShortTemplate: "あと {remaining} 文字入力してください（全 13,009 カードの一括表示を避けるため）。",
    searchFailedError: "選手を検索できませんでした。",
    retryButton: "再試行",
    noResults: "条件に一致するカードがありません。",
    resultCountTemplate: "{count} 件",
    addingLabel: "追加中…",
    addToSlotTemplate: "{slot}へ追加",
    alreadyAddedReason: "比較に追加済み",
    processingReason: "追加処理中",
    addFailedError: "この選手を比較へ追加できませんでした。もう一度お試しください。",
  },
  playerSearchPanel: {
    searchAriaLabel: "スカッドへ追加する選手を検索",
    duplicateNotePrefix: "同じカードの重複配置はできません。同一人物でも別カード（World ID 違い）は追加できます。",
    sortNoteWithPositionTemplate: " 並び: 名前一致 → {position} 一致 → OVR 高い順。",
    sortNoteDefault: " 並び: 名前一致 → OVR 高い順。",
    placedLabel: "配置済み",
    placedWithLocationTemplate: "配置済み: {where}",
  },
  formationSelect: {
    ariaLabel: "フォーメーションを選択",
  },
  squadTemplatesBoard: {
    storageUnavailableHeading: "この環境ではテンプレートを保存できません",
    storageUnavailableNote: "ブラウザの localStorage が使用できません（プライベートモード等）。",
    backToSquadListLink: "← スカッド一覧へ",
    createEmptyHeading: "空テンプレートを作成（フォーメーションのみ）",
    createEmptyNote: "選手を含む「完全テンプレート」は、スカッド一覧の各スカッドの「テンプレ保存」から作成できます（自由配置座標も保存されます）。",
    templateNameLabel: "テンプレート名",
    newTemplateNameAria: "新しいテンプレート名",
    formationLabel: "フォーメーション",
    createButton: "作成",
    defaultEmptyTemplateName: "空テンプレート",
    templatesHeadingTemplate: "テンプレート{countSuffix}",
    templatesCountSuffixTemplate: "（{count}）",
    loadingText: "読み込み中…",
    noTemplatesNote: "テンプレートはまだありません。",
    emptyTypeBadge: "空",
    fullTypeBadge: "完全",
    customPlacementBadge: "カスタム配置",
    startersTemplate: "先発 {count}/11",
    benchTemplate: "ベンチ {count}",
    hasManagerLabel: "監督あり",
    noManagerLabel: "監督なし",
    createFromTemplateButton: "このテンプレートから作成",
    renameButton: "名前変更",
    deleteButton: "削除",
    newSquadNamePrompt: "新しいスカッド名",
    templateNamePrompt: "テンプレート名",
    deleteConfirmTemplate: "テンプレート「{name}」を削除します（このテンプレートだけ・作成済みスカッドは影響を受けません）。",
    deleteConfirmButton: "削除する",
    cancelDeleteButton: "やめる",
    backToSquadListButton: "スカッド一覧へ",
  },
  slotPlayerPanel: {
    slotSuffix: "枠",
    movingCancelButton: "移動先を選択中… キャンセル",
    emptySlotNote: "この枠は空いています。",
    addPlayerButton: "＋ 選手を追加",
    placementRoleLabel: "配置ロール: ",
    autoInferredTemplate: "（自動判定: {role} / 手動指定中）",
    suitabilityLabelTemplate: "選手適性: {label}（登録 {position}）",
    adjustPositionButton: "位置を調整",
    roleLabel: "ロール",
    roleAriaLabelTemplate: "{position} の配置ロール",
    autoRoleOptionTemplate: "自動（{role}）",
    baseToDisplayedOvrPrefixTemplate: "基礎OVR {base} → 表示OVR ",
    estimateNote: "（推定・検証中）",
    progressionDeltaTemplate: "育成 {delta}",
    playerBoosterDeltaTemplate: "選手ブースター（標準適用・固定型推定含む）{delta}",
    managerDeltaTemplate: "監督 {delta}",
    cannotProgressNote: "このカードは育成できません（最大レベル）。",
    attachedBoosterSlotTemplate: "付属{slot}:",
    powerOfManyNote: "金色・可変（Game Plan 依存）・チーム集計に不反映",
    verifiedScreenTemplate: "参考画面で実測確認{fixedNote}・チームに反映",
    externalVerifiedTemplate: "外部照合済み（公式未確認）{fixedNote}・チームに反映",
    underVerificationNote: "効果検証中・不反映",
    fixedTypeEstimateSuffix: "・固定型推定",
    experimentalBoosterPrefix: "実験的なブースター試算（付属を上書き・",
    experimentalBoosterTeamNote: "チーム集計には影響しません",
    experimentalBoosterSuffix: "）",
    noBoosterOption: "なし",
    boosterIdMismatchNote: "カードの数値IDは公開ブースター表と番号体系が一致せず自動判定できません。別カードへは適用されません。",
    progressionPolicyLabel: "育成方針",
    buildModeAriaTemplate: "{position} の育成方針",
    savedBuildOptionTemplate: "保存ビルド: {name}",
    savedBuildAriaTemplate: "{position} の保存ビルドを適用",
    applySavedBuildOption: "保存ビルドを適用...",
    legacyRuleSuffix: "（旧規則）",
    squadBuildLabel: "スカッド用ビルド:",
    notSetLabel: "未設定",
    notFoundDeletedLabel: "見つかりません（削除済み）",
    chooseSavedBuildButton: "保存ビルドを選ぶ",
    staleBuildNote: "保存ビルドが旧規則です。現行規則で再計算中（配分の解釈が変わる場合があります）。",
    moveSwapButton: "移動・交代",
    moveToBenchButton: "ベンチへ",
    removeFromSlotButton: "枠から外す",
    clearCaptainButton: "キャプテン解除",
    setCaptainButton: "キャプテンに設定",
    compareFullLabel: "比較は4人まで",
    playerDetailLink: "選手詳細",
    progressionLinkLabel: "育成",
    boosterSlotAriaTemplate: "{position} の選手ブースター",
    boosterLevelAriaTemplate: "{position} のブースターレベル",
  },
  squadPitch: {
    compatExactTitle: "登録ポジションと一致",
    compatRelatedTitle: "適性未確認（近いポジション）",
    compatUnresolvedTitle: "適性未確認",
    compatMismatchTitle: "不適性の可能性",
    compatEmptyTitle: "未配置",
    snapLabelTemplate: "スナップ: {types}",
    freePlacementLabel: "自由配置",
    guideHorizontalLabel: "同ライン",
    guideCenterLabel: "中央",
    guideSymmetryLabel: "左右対称",
    moveTargetPrefix: "移動先候補 — ",
    moveSourcePrefix: "移動中 — ",
    occupiedSlotAriaTemplate: "{position}: {name}（{compat}）",
    moveTargetSwapSuffix: "・選ぶと入れ替え",
    emptySlotAriaTemplate: "{position}: 空きスロット。",
    moveTargetMoveHereLabel: "選ぶとここへ移動",
    addPlayerLabel: "選手を追加",
  },
  compareSaveBuildDialog: {
    defaultName: "比較画面の育成",
    nameRequiredError: "ビルド名を入力してください（1〜60文字）。",
    saveFailedTemplate: "保存できませんでした: {error}",
    saveErrorGeneric: "保存中にエラーが発生しました（localStorage を利用できない可能性があります）。比較の配分はそのままです。",
    modalTitleTemplate: "{index}人目 {name} の育成を保存",
    intro: "この配分を保存ビルドとして保存します。保存後は選手詳細・My Team・各スカッド編集画面から選択できます。既存スカッドへ自動適用はしません。",
    allocationHeadingTemplate: "育成配分（使用 {used} / 合計 {total}pt）",
    buildNameLabel: "ビルド名",
    buildNameAriaLabel: "保存する育成ビルドの名前",
    saveMethodLegend: "保存方法",
    saveAsNewOption: "新しいビルドとして保存",
    overwriteExistingOption: "既存の保存ビルドを上書き",
    overwriteSelectAriaLabel: "上書きする保存ビルド",
    includePomLabel: "Power of Many のユーザー指定段階を含める",
    pomCurrentTemplate: "（現在: {tier}）",
    pomUnspecifiedNote: "（このカードに指定なし）",
    pomNoSpecificValue: "指定あり",
    footnote: "実験的試算・監督設定は保存ビルドに含まれません（既存の保存ビルド仕様）。fixed booster はカードデータから解決されるため保存しません。",
    cancelButton: "キャンセル",
    overwriteWarningTemplate: "「{name}」を上書きします（元の配分へは自動で戻せません）。",
    overwriteSaveButton: "上書きして保存",
    confirmOverwriteButton: "上書きを確認",
    savingButton: "保存中…",
    saveButton: "保存",
  },
  compareCategoryPreview: {
    headingTemplate: "{label} の対象能力（{mode}）",
    headingHint: "育成前 → 現在（差）",
    noInfoTemplate: "{index}人目: 情報なし",
    valueAriaLabelTemplate: "{index}人目 {name} 育成前 {before} 現在 {now} 差 {diff}",
    personPrefixTemplate: "{index}人目: ",
    diffLabelTemplate: "1人目 − 2人目: ",
    statusLineTemplate: "{index}人目 {label} Lv {level}・使用 {used} / 残り {remaining}pt",
    footnote:
      "値は既存の育成計算（calculateBuild）の結果です。fixed booster・Power of Many・監督補正は「標準 / 条件反映後」モードの値に含まれます（26 能力値表の行を開くとレイヤー別の内訳を確認できます）。",
  },
  compareRadarChart: {
    seriesStyleSolid: "実線・丸",
    seriesStyleDashedSquare: "破線・四角",
    seriesStyleDottedTriangle: "点線・三角",
    seriesStyleDashDotDiamond: "一点鎖線・ひし形",
    altLinePersonTemplate: "{index}人目 {name}（{cardType}）: ",
    graphDisplayLabel: "グラフ表示:",
    personOrdinalTemplate: "{n}人目",
    showPreBuildTemplate: "育成前を表示（{target}）",
    showPreBuildFallback: "選択中",
    chartAriaLabelTemplate: "能力値レーダー（{mode}・カテゴリ単純平均・ポジション別 OVR ではありません）。{altLines}",
    legendPersonTemplate: "{index}人目 {name}（{cardType}・{styleLabel}）",
    categoryValuesSummaryTemplate: "カテゴリ値（数値・{mode}）",
    playerHeader: "選手",
    managerNote: "一部の系列に監督補正が含まれます（標準 / 条件反映後モード）。",
  },
  comparisonTables: {
    deltaProgressionPrefix: "育",
    deltaPlayerBoosterPrefix: "選",
    deltaConditionalPrefix: "条",
    deltaManagerBoosterPrefix: "監",
    rulesLabel: "規則: ",
    estimatedOvrLabel: "推定OVR（検証中）: ",
    boosterModePrefix: "ブースター適用モード: ",
    boosterModeStandard: "標準",
    boosterModeNoteSuffix:
      "（カード付属の効果を外部2ソースで照合したブースターを順位へ反映。発動方式は固定型と推定のものを含みます（Power of Many である具体的証拠がないため）。KONAMI 公式未確認。Power of Many のユーザー指定値と手動試算は順位に含めません）",
    basicInfoHeading: "基本情報",
    itemHeader: "項目",
    positionMatchLabel: "ポジション一致: ",
    yes: "はい",
    no: "いいえ",
    categoryHeading: "カテゴリ比較",
    categoryHeadingHint: "単純合計/平均・公式評価ではない",
    categoryHeader: "カテゴリ",
    diffHeader: "差",
    avgTemplate: "(平均 {value})",
    totalRowLabel: "総合（単純合計）",
    abilitiesHeading: "能力値（26項目）",
    conditionalToggleLabel: "ユーザー指定条件を含む比較（金色・可変ブースターの手動段階を反映・自動判定ではありません）",
    conditionalNote:
      "この表は「条件反映後値」を表示しています。ユーザーが自身の Game Plan を確認して指定した段階に基づく試算で、アプリが編成人数を自動検証した値ではありません。通常の比較順位（既定表示）には含めていません。",
    abilityHeader: "能力値",
    legendPrefix: "小さい表記: ",
    legendProgression: "育=育成デルタ",
    legendPlayerBooster: " / 選=カード付属ブースター（",
    legendStandardMode: "標準モード",
    legendPlayerBoosterDetailSuffix:
      ": スクリーンショット実測 2 種 ＋ eFootball World と EFScout の外部2ソース整合 27 種。発動方式は固定型と推定のものを含みます。KONAMI 公式未確認。検証中・手動試算は含めません）",
    legendConditional: " / 条=Total Package のユーザー指定段階（「条件反映後」表示時のみ・自動判定ではありません）",
    legendManagerBooster: " / 監=監督ブースター。",
    legendSuffix: "既定の順位に Total Package の手動段階は含めません。最も高い値を ",
    legendHighestColor: "緑",
    legendDisplaySuffix: "で表示。",
    skillsHeading: "スキル比較",
    playerSkillsTitle: "選手スキル（Player Skills）",
    aiStylesTitle: "AI プレースタイル（AI Playing Styles）",
    countLabel: "数: ",
    sharedByAllTemplate: "全員が持つ（{count}）",
    noneLabel: "なし",
    partialTitle: "一部だけが持つ",
    uniqueToPlayerTemplate: "{name} 固有（{count}）",
  },
  comparisonCockpit: {
    abilitiesTableLink: "26 能力値表へ ↓",
    backToTrainingLink: "育成へ戻る ↑",
    ariaLabel: "比較コックピット（育成・能力値レーダー・カテゴリプレビュー）",
    heading: "比較コックピット",
    headingHint: "育成スライダーを操作すると、レーダーとカテゴリ値・26 能力値表が即時更新されます。",
    selectPlayerAriaLabel: "育成する選手を選択",
    playerTabTemplate: "{index}人目 {name}",
    activeSuffix: "（育成中）",
  },
  compareTrainingPanel: {
    cannotProgressNote: "このカードは育成できません（能力値は基礎値のまま）。",
    autoAllocatedAnnounceTemplate: "{name}: {mode}の配分を適用しました。",
    resetButton: "リセット",
    resetAnnounceTemplate: "{name}: 育成をリセットしました。",
    saveThisBuildButton: "この育成を保存",
    autoAllocateNote:
      "自動育成は「配分方針」のヒューリスティックです。ゲーム内の自動配分・OVR 最大化とは異なります。適用後もスライダーで調整できます。",
    usedPointsLabel: "使用 {value}pt",
    remainingPointsLabel: "残り {value}pt",
    overAllocatedLabel: "配分超過",
    totalPointsLabel: "合計 {value}pt",
    gkHeading: "GK育成 3 項目",
    gkLevelLabelTemplate: "配分 Lv {level}",
    gkExpandedSuffix: "（GK・初期展開）",
    gkCollapsedSuffix: "（非GK・初期折りたたみ）",
    definitionNote: "カテゴリの対象能力・段階コスト・上限は選手詳細の育成画面と同一の定義です。同じ配分なら 26 能力値も一致します。",
    manualSuffix: "（手動）",
    embeddedHeadingTemplate: "{name} の育成",
    collapsedHeading: "育成を調整",
  },
  comparePlayerIdentityCard: {
    cardImageAltTemplate: "{name} {cardType} カード画像",
    noEnglishName: "（英語名なし）",
    ovrTooltip: "保存済みのカード全体 OVR（ポジション別ではありません）",
    ovrLineTemplate: "最大 {max} / 基礎 {base}",
    pomChipTooltip: "Power of Many（金色・Game Plan 依存・比較の順位へ自動反映しません）",
    fixedProvisionalTooltip:
      "固定型（推定）: 効果内容は外部照合済み。Power of Many である具体的証拠が無いため固定型と推定して標準値へ暫定適用しています。",
    fixedTooltip: "固定型（標準モードで標準値へ反映）",
    unresolvedTooltip: "発動方式・効果を確認できていない付属ブースター",
    pomChipTemplate: "{nameEn} 最大+{level}",
    fixedChipTemplate: "{nameEn} +{level}",
    provisionalSuffix: "（推定）",
    unresolvedChip: "未解決",
    noAttachedBoosters: "付属ブースターなし",
    pomSelectionLabelTemplate: "Power of Many 指定: {tier}（ユーザー指定・条件反映後値のみ）",
    currentTrainingTemplate: "現在: {label}",
    playerDetailLink: "選手詳細",
    progressionScreenLink: "育成画面",
  },
  playerControlColumn: {
    removeAriaTemplate: "{name} を比較から削除",
    savedBuildTrainingLabelTemplate: "保存ビルド: {name}",
    manualTrainingLabel: "手動育成",
    followsPolicyLabel: "育成方針に従う",
    trainingPolicyLabel: "育成方針",
    trainingPolicyAriaTemplate: "{name} の育成方針",
    savedBuildOptionTemplate: "保存ビルド: {name}",
    manualTrainingOption: "手動育成（下のスライダー）",
    applyBuildAriaTemplate: "{name} の保存ビルドを適用",
    applyBuildDefaultOption: "保存ビルドを適用...",
    trainingConsolidatedNoteTemplate:
      "育成スライダーは下の「比較コックピット」でまとめて操作できます（{mode}・使用 {used}/{total}pt）。",
    positionFitSummary: "ポジション適性",
    registeredPositionLabel: "登録ポジション: ",
    currentOverallLabel: "現在の育成でのポジション別総合値: ",
    currentOverallValue: "—",
    currentOverallNote: "（計算規則を確認中）",
    overallExplanation:
      "現在の育成内容は上の 26 能力値比較へ反映されています。ポジション別総合値は KONAMI が算式・能力重み・丸め規則を公開しておらず、複数カードの表示値サンプルも不足しているため、推測値を表示していません（架空の数値は出しません）。",
    attachedBoosterPrefixTemplate: "付属{slot}: ",
    powerOfManyNote: "可変ブースター（金色・Game Plan 依存）・比較の順位に不反映",
    verifiedScreenshotNoteTemplate: "参考画面で実測確認{fixedSuffix}・比較に反映",
    fixedEstimateSuffix: "・固定型推定",
    externalCrossVerifiedNoteTemplate: "外部照合済み（公式未確認）{fixedSuffix}・比較に反映",
    underVerificationNote: "効果検証中・比較に不反映",
    additionalBoosterPrefix: "追加ブースター（B2・付属を上書き・",
    additionalBoosterHighlight: "確認済みは比較の順位へ反映",
    additionalBoosterSuffix: "）",
    boosterLevelAriaTemplate: "{name} のブースターレベル",
    additionalBoosterAriaTemplate: "{name} の追加ブースター（B2）",
    noneOption: "なし",
    boosterFootnotePrefix: "カード付属ブースターは ",
    boosterFootnoteHighlight: "標準モード",
    boosterFootnoteSuffix:
      "で比較へ反映（スクリーンショット実測 2 種 ＋ eFootball World と EFScout の外部2ソース整合 27 種。発動方式は固定型と推定のものを含む。KONAMI 公式未確認）。追加ブースター（B2）はそのカードのみ・スロットの付属を上書きします。確認済みのB2（この一覧はすべて確認済み）は通常の最終値・比較の順位へも反映します。",
    managerLabel: "監督",
    managerClearButton: "解除",
    noManagerLabel: "監督なし",
    managerChangeButton: "変更",
    managerChooseButton: "監督一覧から選択",
  },
  comparisonBoard: {
    sameTrainingLabel: "全員に同じ育成:",
    sameManagerLabel: "全員に同じ監督:",
    chooseFromManagerListButton: "監督一覧から選択",
    clearAllManagersButton: "全員の監督を解除",
    perPlayerManagerNote: "個別に監督を変える場合は各選手の列で設定できます。",
    sharedManagerPickerTitle: "全員に適用する監督を選択",
    perPlayerManagerPickerTitleTemplate: "{name} の監督を選択",
    fallbackPlayerName: "選手",
    maxPlayersErrorTemplate: "比較は最大{max}人です。",
    duplicateCardError: "同じカードは重複して追加できません。",
    fetchPlayerFailedError: "選手を取得できませんでした。",
    fetchPlayerErrorGeneric: "選手の取得に失敗しました。",
    buildSavedNoticeTemplate: "「{name}」を保存しました（選手詳細・My Team・スカッドから選択できます）。",
    confirmOverwriteWarningTemplate: "手動配分 / 保存ビルドを設定した列があります。「{mode}」を全員へ適用すると上書きされます。",
    overwriteTargetsLabel: "上書き対象: ",
    overwriteTargetTemplate: "{index}人目（{name}）",
    overwriteApplyButton: "上書きして適用",
    overwriteCancelButton: "やめる",
    selectSlotOrdinalTemplate: "{n}人目を選択",
    addPlayerToSlotButtonTemplate: "＋ {n}人目へ選手を追加",
    maxPlayersNoteTemplate: "比較は最大{max}人です。別の選手を追加するには、いずれかの ✕ で削除してください。",
    needTwoPlayersTitle: "比較するには選手を2人以上選んでください",
    needTwoPlayersDescriptionTemplate:
      "上の空きスロットの「＋ 比較へ選手を追加」から選択できます（最大{max}人）。同一人物の別カードも比較できます。",
    browseHighOvrButton: "高OVRカードから探す",
  },
  comparePage: {
    title: "選手比較",
    description:
      "2〜4 人の World カードを並べて、基本情報・26 能力値・スキル・育成ビルド・監督補正を比較します。育成・監督補正は既存の計算エンジンを再利用（規則は「検証中」）。URL に選手・育成方針・監督が入り、共有できます。",
    backToPlayers: "プレイヤー一覧へ",
    dataUnavailableTitle: "データが利用できません",
    dataUnavailableDescription: "SQLite に World データが取り込まれていません。",
  },
  worldPlayerHero: {
    backToList: "プレイヤー一覧へ",
    noImage: "画像なし（NO IMAGE）",
    maxOvrLabel: "最大 OVR",
    baseAndCapTemplate: "基礎 {base} / Lv上限 {cap}",
    noEnglishName: "（英語名なし）",
    idBadgeTemplate: "ID {id}",
    baseOvrLabel: "基礎OVR",
    maxOvrFactLabel: "最大OVR",
    maxLevelLabel: "最大レベル",
    preferredFootLabel: "利き足",
    heightWeightTemplate: "身長 / 体重",
    teamLabel: "チーム",
  },
  playerDetailPage: {
    worldDataUnavailableTitle: "World データが利用できません",
    worldDataUnavailableDescription: "SQLite に World データが取り込まれていません。",
    backToPlayerList: "プレイヤー一覧へ戻る",
    analysisScopeWorldEfhub: "World + eFHUB 詳細",
    analysisScopeWorld: "World データ",
    nationalityLabel: "国籍",
    regionLabel: "地域",
    leagueLabel: "リーグ",
    teamLabel: "チーム",
    ageLabel: "年齢",
    heightLabel: "身長",
    weightLabel: "体重",
    preferredFootLabel: "利き足",
    playingStyleLabel: "攻撃プレースタイル",
    playingStyleDefLabel: "守備プレースタイル",
    booster1Label: "ブースター1 (ID)",
    booster2Label: "ブースター2 (ID)",
    basicInfoHeading: "基本情報",
    statsHeading: "能力値（26 項目・World 値）",
    statsHint: "育成後・監督補正は含みません",
    playerSkillsHeading: "Player Skills",
    noSkills: "スキル情報がありません。",
    aiStylesHeading: "AI Playing Styles",
    noAiStyles: "AI スキルはありません。",
    progressionHeading: "育成（検証中）",
    dataProvenanceHeading: "データの来歴",
    dataSourceLabel: "データソース",
    sourceUrlLabel: "取得元 URL",
    appearanceUpdatedLabel: "更新日時（appearance）",
    fetchedAtLabel: "取得日時",
    efhubDiffHeading: "eFHUB 値との差異（参考・自動上書きしません）",
    tableItemHeader: "項目",
    tableWorldHeader: "World",
    tableEfhubHeader: "eFHUB",
    notYetHeading: "未取得（追加調査中）",
    notYetHint: "players/search API に含まれない項目",
    notYetZeroNote: "0 や空文字では表示しません。",
    notYetBadgeSuffix: ": 追加調査中",
    notYetSecondaryPosition: "副ポジション適性",
    tabsAriaLabel: "選手詳細",
    tabOverview: "概要",
    tabStats: "能力値",
    tabSkills: "スキル",
    tabProgression: "育成",
    tabData: "データ情報",
  },
  legacyPlayerDetail: {
    backToList: "← プレイヤー一覧へ戻る",
    noJapaneseName: "（日本語名なし）",
    noEnglishName: "（英語名なし）",
    efhubIdLabel: "選手ID（eFHUB）",
    ovrLabel: "OVR",
    provenanceHeading: "データの来歴",
    dataSourceLabel: "データソース",
    sourceUrlLabel: "取得元 URL",
    httpMethodLabel: "HTTP メソッド",
    fetchedAtLabel: "取得日時",
    noSourceInfo: "取得元情報がありません。",
    futureHeading: "今後のバージョンで実装予定",
    futureDescription:
      "能力値（攻撃/守備/身体能力）、スキル、プレースタイル、ポジション別総合値、育成、ブースター、Tier、選手比較。これらは eFHUB の個別選手データを追加調査したうえで実装します（docs/efootball-team-ai-design.md の Phase 1〜2）。",
    imageProxyNote: "選手画像は efimg.com から自前プロキシ（/api/player-image/[id]）経由で取得しています。",
  },
  worldFilters: {
    sortOvrMaxDesc: "最大OVR 高い順",
    sortOvrMaxAsc: "最大OVR 低い順",
    sortOvrBaseDesc: "基礎OVR 高い順",
    sortOvrBaseAsc: "基礎OVR 低い順",
    sortName: "名前順（英語）",
    sortUpdatedDesc: "更新が新しい順",
    filterLabelQ: "検索",
    filterLabelPosition: "ポジション",
    filterLabelCardType: "カードタイプ",
    filterLabelPlayingStyle: "攻撃PS",
    filterLabelPlayingStyleDef: "守備PS",
    filterLabelMinOvr: "最大OVR ≥",
    filterLabelMaxOvr: "最大OVR ≤",
    filterLabelBooster: "ブースター",
    searchPlaceholder: "日本語名・英語名・World ID・eFHUB ID",
    searchAriaLabel: "選手を検索",
    sortAriaLabel: "並べ替え",
    filterToggleTemplate: "フィルター{count}",
    positionAriaLabel: "ポジション",
    positionAll: "ポジション: 全て",
    cardTypeAriaLabel: "カードタイプ",
    cardTypeAll: "タイプ: 全て",
    playingStyleAriaLabel: "攻撃プレースタイル",
    playingStyleAll: "攻撃PS: 全て",
    playingStyleDefAriaLabel: "守備プレースタイル",
    playingStyleDefAll: "守備PS: 全て",
    minOvrPlaceholder: "最大OVR ≥",
    minOvrAriaLabel: "最大OVR 下限",
    maxOvrPlaceholder: "最大OVR ≤",
    maxOvrAriaLabel: "最大OVR 上限",
    clearAllButton: "すべて解除",
  },
  worldPlayerCard: {
    noEnglishName: "（英語名なし）",
    baseOvrLabel: "基礎 {value}",
    levelCapLabel: "Lv上限 {value}",
  },
  worldPagination: {
    ariaLabel: "ページ送り",
    rangeTemplate: "{total} 件中 {from}〜{to} 件を表示",
    prevLabel: "← 前へ",
    nextLabel: "次へ →",
    pageOfTemplate: "{page} / {totalPages}",
  },
  playersPage: {
    title: "プレイヤー",
    metaTemplate: "{count} 人の選手",
    descriptionTemplate: "eFootball World の全カードを検索・絞り込み。{importedAt}",
    importedAtPrefix: "取り込み: ",
    compareLink: "選手比較へ",
    noDataTitle: "World データがまだ用意されていません",
    noDataDescription: "ターミナルで `node scripts/sync-world-players-initial.mjs` を実行して SQLite に取り込んでください。",
    loadErrorTitle: "選手データを読み込めませんでした",
    loadErrorDescription: "時間をおいて再読み込みしてください。解決しない場合は SQLite の状態を確認してください。",
    noResultsTitle: "条件に一致する選手がいません",
    noResultsDescription: "検索語やフィルターを変えてみてください。フィルターのチップを押すと個別に解除できます。",
    clearAllFiltersButton: "すべての条件を解除",
    noCardsTitle: "表示できるカードがありません",
    noCardsDescription: "World データの取り込みを確認してください。",
    showingRangeTemplate: "{total} 人中 {from}〜{to} 人を表示",
    dataSourcePrefix: "データソース: ",
    defaultSourceName: "eFootball World",
  },
  tagEditor: {
    duplicateTag: "同じタグがすでにあります",
    maxTagsTemplate: "タグは最大 {max} 個です",
    labelTemplate: "タグ（任意・最大 {maxTags} 個・1 個 {maxLen} 文字まで）",
    removeTagAriaTemplate: "タグ「{tag}」を削除",
    placeholder: "例: 主力 / ドリブラー / 育成候補",
    addButton: "追加",
  },
  myTeamAddDialog: {
    editTitle: "My Team の記録を編集",
    addTitle: "My Team に追加",
    saveFailedFallback: "保存できませんでした",
    introAddTemplate:
      "{playerName}（ID {worldCardId}）を My Team に追加します。My Team は実際に保有しているカードの管理用です。お気に入りとは独立していて、ここへの追加でお気に入りには追加されません。",
    introEditTemplate:
      "{playerName}（ID {worldCardId}）の My Team 記録を編集します。My Team は実際に保有しているカードの管理用です。お気に入りとは独立しています。",
    ownershipLabel: "所有状態",
    usageLabel: "使用状態（任意）",
    usageNote: "使用状態はスカッド配置の事実とは別です。「主力」にしても自動でスカッドへ配置しません。",
    noteLabelTemplate: "メモ（任意・{max} 文字まで）",
    notePlaceholder: "例: ST起用予定 / 対人で強い / 次に育成を調整",
    noteCountTemplate: "{count} / {max}",
    cancelButton: "キャンセル",
    saveButton: "保存",
    addButton: "My Team に追加",
  },
  myTeamButton: {
    registeredAria: "My Team に登録済み",
    registeredLabel: "My Team 登録済み",
    openInMyTeamLink: "My Team で開く",
    addButton: "My Team に追加",
    unavailableNote: "このブラウザでは保存できません",
  },
  favoritesView: {
    pageTitle: "お気に入り",
    pageDescription: "気になるカードを保存して、あとで育成・比較を確認できます。所有していないカードも登録できます。",
    emptyTitle: "お気に入りはまだありません",
    emptyDescription: "選手一覧や選手詳細の星アイコンから追加できます。所有していないカードも登録できます。",
    noResultsTitle: "条件に一致するお気に入りがありません",
    removeLabel: "お気に入り解除",
  },
  favoriteButton: {
    saveFailedFallback: "保存できませんでした",
    removeLabel: "お気に入りから解除",
    addLabel: "お気に入りに追加",
    favoritedCompactLabel: "お気に入り済み",
    notFavoritedCompactLabel: "お気に入り",
    favoritedLabel: "お気に入り済み",
    addFavoriteLabel: "お気に入りに追加",
    unavailableNote: "このブラウザでは保存できません（閉じると失われます）",
  },
  userCardFilters: {
    sortAddedDesc: "登録が新しい順",
    sortAddedAsc: "登録が古い順",
    sortOvrDesc: "OVR が高い順",
    sortOvrAsc: "OVR が低い順",
    sortName: "名前順",
    sortPosition: "ポジション順",
    searchSrLabel: "検索",
    searchPlaceholder: "選手名 / チーム / 国籍 / カード ID",
    sortAriaLabel: "並び替え",
    positionFilterAriaLabel: "ポジションで絞り込み",
    positionFilterAll: "ポジション: すべて",
    cardTypeFilterAriaLabel: "カードタイプで絞り込み",
    cardTypeFilterAll: "カードタイプ: すべて",
    ownershipFilterAriaLabel: "所有状態で絞り込み",
    ownershipFilterAll: "所有状態: すべて",
    ownershipOwned: "所有済み",
    ownershipWanted: "欲しい",
    ownershipReleased: "手放した",
    ownershipUnknown: "未設定",
    inTeamFilterAriaLabel: "所有で絞り込み",
    inTeamFilterAll: "所有: すべて",
    inTeamFilterYes: "My Team にあり",
    inTeamFilterNo: "My Team になし",
    boosterFilterAriaLabel: "ブースターで絞り込み",
    boosterFilterAll: "ブースター: すべて",
    boosterFilterHas: "ブースターあり",
    boosterFilterPom: "Power of Many あり",
    clearFiltersButton: "条件をクリア",
    countTemplate: "{shown} / {total} 件",
  },
  userCardTile: {
    compareAddedMsg: "比較へ追加しました",
    compareAlreadyMsg: "すでに比較にあります",
    compareFullMsg: "比較は最大人数です",
    compareFailedMsg: "追加できませんでした",
    resolvingCardInfo: "カード情報を解決中…",
    boosterGold: "金",
    boosterBlue: "青",
    noBuildsSaved: "Team AI 内ビルドなし",
    selectedBuildTemplate: "選択中ビルド: {name}（保存 {count} 件）",
    buildsSavedTemplate: "Team AI 内ビルド保存済み（{count} 件）",
    usedInSquadsCountTemplate: "{count} スカッドで使用中: ",
    detailLink: "詳細",
    progressionLink: "育成",
    addToCompareButton: "比較へ追加",
    defaultRemoveLabel: "解除",
    ownershipOwned: "所有済み",
    ownershipWanted: "欲しい",
    ownershipReleased: "手放した",
    ownershipUnknown: "未設定",
    usageMain: "主力",
    usageRotation: "ローテーション",
    usageReserve: "控え",
    usageUnused: "未使用",
    usageUnknown: "未設定",
  },
  localStorageNotice: {
    whatFavorites: "お気に入り",
    whatMyTeam: "My Team",
    whatBuilds: "保存した育成ビルド",
    whatFavoritesAndMyTeam: "お気に入りと My Team",
    bodyPrefixTemplate: "{what}は、現在",
    bodyBold: "このブラウザにのみ",
    bodySuffix:
      "保存されます。別の端末との同期やバックアップ、サーバーへの保存には未対応です。ログイン・アカウント同期は今後のバージョンで対応予定です。",
  },
  myTeam: {
    pageTitle: "My Team",
    pageDescription: "実際に保有しているカードを管理し、育成ビルド・比較・スカッドへつなげます。お気に入りとは独立した管理です。",
    emptyTitle: "My Team にはまだカードがありません",
    emptyDescription: "所有しているカードを追加して、育成ビルドやスカッドへつなげられます。",
    findPlayersLink: "選手を探す",
    viewFavoritesLink: "お気に入りを見る",
    notAvailableNotice: "このブラウザでは保存できません。追加・変更はページを閉じると失われる可能性があります。",
    ownedCardCountLabel: "所有カード数",
    totalFavoriteCountLabel: "お気に入り数（全体）",
    mainCardCountLabel: "主力カード数",
    buildsSavedCountLabel: "Team AI 内ビルド保存済み",
    buildsSavedNote: "「ビルド保存済み」は Team AI 内の保存状態です。ゲーム内の実際の育成状態とは別です。",
    noResultsTitle: "条件に一致するカードがありません",
    noResultsDescription: "検索語やフィルターを変えてみてください。",
    clearFiltersButton: "条件をクリア",
    resolvingCards: "カード情報を解決中…",
    editButton: "編集",
    useInSquadLink: "スカッドで使用",
    removeFromMyTeamLabel: "My Team から削除",
    savedBuildHeading: "保存ビルド",
    selectedPrefix: "選択中: ",
    favoritePrefix: "お気に入り: ",
    noneLabel: "なし",
    buildMissingLabel: "見つかりません（削除済み）",
    savedCountSuffix: "保存 {count} 件",
    quickSelectLabel: "かんたん選択:",
    quickSelectNone: "なし",
    legacyRulesSuffix: "（旧規則）",
    chooseBuildButton: "保存ビルドを選ぶ",
    openInProgressionLink: "育成で開く",
    removeConfirmTitle: "My Team から削除しますか？",
    removeConfirmButton: "My Team から削除",
    removeConfirmBodyTemplate: "{name} を My Team から削除します。",
    removeConfirmNote: "お気に入り、保存した育成ビルド、保存スカッド、比較の状態は削除されません（関連付けだけ解除されます）。",
    customUsageSuffix: "・カスタム",
    starterUsageTemplate: "先発 {role}",
    captainUsageSuffix: "・C",
    benchUsageLabel: "ベンチ",
    selectedBuildAriaTemplate: "{name} の選択中ビルド",
  },
  bench: {
    modeNone: "育成なし",
    modeAttack: "攻撃",
    modeDefense: "守備",
    modeBalance: "バランス",
    modeGk: "GK",
    heading: "ベンチ",
    addButton: "＋ ベンチ選手を追加",
    empty: "ベンチ選手は未登録です。",
    moveCandidatePrefix: "移動先候補 — ",
    movingPrefix: "移動中 — ",
    benchSlotLabel: "ベンチ",
    moveSwapSuffix: "・選ぶと入れ替え",
    moveStartSuffix: "・選ぶと移動・交代を開始",
    positionUnknown: "?",
    displayedOvrPrefix: "表示OVR ",
    ovrUnknown: "–",
    loadingLabel: "読み込み中…",
    errorLabel: "取得失敗",
    moveUpAriaTemplate: "{name} を上へ",
    moveDownAriaTemplate: "{name} を下へ",
    removeButton: "外す",
    staleBuildLabel: "旧規則ビルド",
    buildModeAriaTemplate: "{name} のベンチ育成方針",
    squadBuildLabelPrefix: "スカッド用ビルド: ",
    buildNotSet: "未設定",
    buildDeleted: "削除済み",
    chooseBuildButton: "保存ビルドを選ぶ",
    moveToBenchAria: "移動先候補 — ベンチへ移動",
    moveToBenchButton: "ここへ（ベンチへ移動）",
  },
  bestXi: {
    pageTitle: "AIベスト11 | eFootball Team AI",
    heading: "AIベスト11",
    description: "保存済みの選手とビルドから、ルールベースで先発11人を選出します。",
    disclaimerNotAi: "AIベスト11は、保存済みデータと決定的な選考ルールを使用します。生成AIは使用せず、外部AIサービスへデータを送信しません。",
    modeLabel: "総合型・全体配置最適化",
    modeDescription: "総合型・全体配置最適化は、11人分のスロットをまとめて比較し、1人だけ極端に評価が高くても他の弱いスロットが隠れないようにしたうえで、あなたの保存済み候補の中から4-3-3の先発11人を選出します（重み付き合計の「AIスコア」は使用しません）。",
    formationNotice: "初期版は4-3-3で選出します。",
    criteriaHeading: "選考基準（優先順）",
    criteriaFilledSlots: "1. 埋められる必須スロット数を最大化する",
    criteriaExactPosition: "2. 本職ポジションでの配置数を最大化する",
    criteriaRelatedMinimized: "3. 同系統ポジションでの配置は必要最小限にとどめる",
    criteriaPositionRatingBalance: "4. 各ポジションの推定評価を、最も弱いスロットから底上げするように比較する（1人だけ突出していても他を隠さない）",
    criteriaAbilityDataConfidence: "5. 能力データを確認できている候補を優先する",
    criteriaIntentSupplementary: "6. 保存済みの育成目的（使用予定ポジション）は、実際の適性・評価を上書きしない補助的な判断材料としてのみ使う",
    resultStatsTemplate: "{filled} / 11 スロットが埋まりました（本職 {exact} 人・同系統 {related} 人）",
    candidatePoolTemplate: "候補: 保存済み選手 {playerCount} 人、利用可能なビルド {buildCount} 件",
    generateButton: "ベスト11を作成",
    regenerateButton: "再選出",
    generatingText: "選考しています…",
    staleNoticeText: "候補データが変更されている可能性があります。最新の内容で再選出してください。",
    emptyMyTeamHeading: "My Teamに選手が登録されていません",
    emptyMyTeamBody: "AIベスト11は、My Teamに登録した選手カードと保存ビルドから選考します。まずはMy Teamへ選手を登録してください。",
    goToMyTeamLink: "My Teamへ",
    goToBuildInventoryLink: "保存ビルドを見る",
    unfilledSlotsHeading: "空きスロット",
    unfilledSlotNoCandidate: "候補が見つかりません。",
    unfilledSlotOnlyIneligibleCandidates: "適格な候補が見つかりません。",
    needMorePlayersTemplate: "先発11人を完成するには、あと {count} 人の候補が必要です。",
    needOnePlayerText: "先発11人を完成するには、あと1人の候補が必要です。",
    addPlayersHint: "My Teamへ選手を追加するか、保存ビルドを作成してください。",
    selectedBuildLabel: "採用ビルド",
    noSavedBuildLabel: "保存ビルドなし（現在確認できる能力値）",
    suitabilityLabel: "ポジション適性",
    suitabilityExact: "本職",
    suitabilityRelated: "適性未確認（近いポジション）",
    suitabilityUnresolved: "適性未確認",
    positionRatingLabel: "このポジションでの推定評価",
    positionRatingUnavailable: "評価不可",
    reasonsHeading: "選考理由",
    reasonExactPosition: "登録ポジションと一致しています。",
    reasonTopPositionRating: "候補内でこのポジションの評価が最も高い選手です。",
    reasonOnlyEligibleCandidate: "このスロットで唯一の候補です。",
    reasonBestBuildAmongOwnBuilds: "同じ選手の複数の保存ビルドの中で、このビルドが最も適しています。",
    reasonFullAbilityDataConfirmed: "保存ビルドの能力データを確認できています。",
    reasonNoSavedBuildUsesBaseStats: "保存ビルドが無いため、現在確認できる能力値を使用しています。",
    reasonIntentPositionMatch: "保存済みの育成目的で申告している使用予定ポジションと一致しています(補助的な理由です)。",
    reasonOptimalOverallPlacement: "この選手個人にとっての最適ポジションではありませんが、チーム全体の配置を最適化するためにこのスロットが選ばれています。",
    alternativesHeading: "有力な選外候補",
    alternativesEmptyText: "有力な選外候補はありません。",
    alternativesSlotPrefixTemplate: "{position}:",
    exclusionSameCardBuildUsedElsewhere: "同じ選手の別の保存ビルドが、このチーム内の別の位置で採用済みです。",
    exclusionLowerPositionRating: "採用された選手の方が、このポジションでの評価が高い結果でした。",
    exclusionLowerSuitability: "採用された選手の方が、ポジション適性で上回りました。",
    exclusionAbilityDataUnavailable: "能力値データを確認できませんでした。",
    exclusionUsedInOtherRequiredSlot: "同じ選手が、他の必須スロットで採用されています。",
    exclusionNoAppropriateSlotInFormation: "このフォーメーションには適切な配置先がありません。",
    exclusionLegacyRulesLimitedComparison: "旧規則で保存されたビルドのため、比較に制限があります。",
    exclusionPositionSuitabilityUnresolved: "このポジションへの適性を確認できないため、自動選出の対象外です。",
    exclusionGkFieldMismatch: "GKとフィールドプレーヤーのポジションが一致しないため、自動選出の対象外です。",
    limitationsHeading: "制限事項",
    limitationSingleFormationOnly: "初期版は4-3-3のみに対応しています。",
    limitationNoBenchSelection: "ベンチメンバーの選出は行いません。",
    limitationNoManagerSelection: "監督補正は今回のバージョンでは適用していません。",
    limitationPersonIdentityUnavailable: "同一の実在選手が複数カードにまたがる場合の重複判定は、確実な識別情報が無いため今回は行っていません（同一カード・同一保存ビルドの重複は防止しています）。",
    limitationAdditionalPositionAptitudeLimited: "副ポジション適性のデータは一部のカードでしか確認できないため、多くの候補では登録ポジションのみで判定しています。",
    limitationLargeCandidatePoolBounded: "候補数が非常に多い場合は、各ポジションの上位候補を使って決定的に選出します。",
    notAWinPredictionText: "勝率や試合結果を予測する機能ではありません。",
    resultsNotSavedText: "この選考結果は保存されません。画面を離れると消えます。",
    withinYourCandidatesText: "あなたの保存済み候補内でのベスト11です。",
    unavailableCardNoWorldCardData: "選手データを取得できませんでした。",
    unavailableCardNoAbilityData: "能力値データを確認できませんでした。",
    unavailableCardsHeading: "候補にできなかったMy Teamの選手",
    pitchViewHeading: "フォーメーション表示",
    listViewHeading: "選出選手一覧",
    slotEmptyLabel: "未選出",
    legacyRuleBadge: "旧規則",
    alternativeCandidateCountTemplate: "他 {count} 人の候補あり",
    playerDetailToggleAriaTemplate: "{name} の選考理由を開閉",
    closePanelAriaTemplate: "{name} の詳細を閉じる",
  },
  footer: {
    ariaLandmark: "サイトフッター",
    aboutLink: "サービス概要",
    termsLink: "利用規約",
    privacyLink: "プライバシー",
    disclaimerLink: "免責事項",
    dataManagementLink: "データ管理",
    supportLink: "問い合わせ",
    releaseReadinessLink: "公開準備状況",
    unofficialNotice: "eFootball Team AIは、eFootballの公式サービスではありません。分析結果は独自のルールベース評価です。",
    draftBadge: "ベータ公開準備中",
  },
  about: {
    pageTitle: "サービス概要 | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIで現在利用できる機能・利用できない機能をまとめた説明ページです。",
    heading: "サービス概要",
    intro: "eFootball Team AIは、選手データの閲覧・育成計算・チーム編成を支援する非公式ツールです。現在はベータ公開準備段階であり、この画面では現時点で確認できる機能だけを説明します。",
    ruleBasedNotice: "「AIベスト11」など「AI」という名称を含む機能も、生成AIではなく、確認可能な能力値と決定的なルールに基づくルールベースの分析です。",
    externalAiNotice: "分析内容を外部AIサービスへ送信することはありません。",
    scopeNotice: "分析は、あなたが保存した候補(My Team・保存ビルド)の中だけで行われます。",
    availableHeading: "利用可能な機能",
    availablePlayerBrowsing: "選手・カード情報の閲覧",
    availableProgressionCalc: "育成計算(26能力値・通常OVR・ポジション別評価)",
    availableMyTeam: "My Team(所有選手の管理)",
    availableSavedBuilds: "保存ビルド(育成配分の保存)",
    availableBuildAnalysis: "Build Analysis(育成方針の分析)",
    availablePresets: "育成目的プリセット(45件・9カテゴリ)",
    availableNormalHarshMode: "通常評価・辛口評価(表現の違いのみで計算結果は同じです)",
    availableCardCompare: "同一カードの複数ビルド比較",
    availableDiagnosisCard: "診断結果カード",
    availablePngExport: "PNG画像として保存",
    availableSavedSquads: "保存スカッド(編成の保存)",
    availableSquadDiagnosis: "スカッド診断",
    availableBestXi: "AIベスト11(保存済み候補からのルールベース選出)",
    availableJsonBackup: "JSONによる保存ビルドのバックアップ(エクスポート・インポート)",
    betaHeading: "ベータ機能(既知の制約があります)",
    betaBestXiIntro: "AIベスト11は動作しますが、次の既知の制約があります。",
    betaBestXiDedupLimit: "同一の実在選手が複数の異なるカードにまたがる場合の重複判定は行っていません。",
    betaBestXiSubPositionLimit: "副ポジション適性のデータは一部のカードでしか確認できません。",
    betaBestXiPoolScopeLimit: "選出は、あなたが保存した候補の中だけで行われます(全カードから自動で探すものではありません)。",
    notProvidedHeading: "未提供の機能",
    notProvidedAccount: "アカウント登録・ログイン",
    notProvidedSync: "端末間の自動同期",
    notProvidedCloudBackup: "クラウドバックアップ",
    notProvidedFriends: "フレンド機能",
    notProvidedRanking: "ランキング機能",
    notProvidedBilling: "決済・課金",
    notProvidedPro: "Pro(有料)プラン",
    notProvidedNativeApp: "ネイティブアプリ",
    notProvidedVoiceChat: "音声通話",
    notProvidedGenerativeAi: "生成AI・外部AI APIとの連携",
    notOfficialNotice: "本サービスはeFootball・KONAMIの公式サービスではありません。",
    winRateNotice: "分析結果は勝率や試合結果を保証するものではありません。",
    draftNotice: "このページは現行の実装内容に基づく、ベータ公開準備用の説明です。正式公開前に内容が変更される場合があります。",
  },
  disclaimer: {
    pageTitle: "免責事項 | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIが非公式サービスであること、および分析結果の性質についての免責事項です。",
    heading: "免責事項",
    intro: "本サービスをご利用いただく前に、以下の内容をご確認ください。",
    unofficialHeading: "非公式サービスについて",
    unofficialBody: "eFootball Team AIは、eFootballの公式サービスではありません。本サービスの分析結果は独自のルールベース評価です。",
    unofficialBody2: "「公式AI」「公式評価」「公認ツール」「公式データベース」「公式ライセンス取得済み」「運営会社と提携済み」であることを確認できる文書は正本内に存在しないため、本サービスはそれらを名乗りません。",
    rightsHeading: "選手名・カード・クラブ名・データ・画像について",
    rightsBody: "本サービスが表示する選手名・カード情報・監督情報・画像は、第三者が提供する情報源(選手データベースサイト等)を参照しています。これらは本サービスの運営者が作成したものではありません。",
    rightsBody2: "これらのデータ・画像について、再配布を明示的に許諾する契約書やライセンス文書は、正本内で確認できていません(公開前確認事項)。選手名・カード名・クラブ名・リーグ名等に関する権利は、それぞれの権利者に帰属します。",
    rightsContactPointer: "掲載内容の削除・修正等をご希望の権利者の方は、「問い合わせ」ページの権利者向け窓口からご連絡ください。",
    analysisHeading: "分析結果について",
    analysisRuleBased: "現在のBuild Analysis、スカッド診断、AIベスト11は、確認可能な能力値と決定的なルールを使用します。生成AIサービスや外部AI APIへデータを送信しません。",
    analysisNotOfficial: "ゲーム公式の評価・能力値ではありません。",
    analysisNoWinGuarantee: "勝率を保証しません。",
    analysisNoUsageGuarantee: "選手の実際の使用感を保証しません。試合結果を保証しません。",
    analysisMayBeOutdated: "ゲームの更新により、分析結果が古くなる場合があります。",
    analysisDataLimits: "能力値データが不足しているカードや、旧規則で保存されたビルドでは、分析に制限があります。",
    analysisUserDecision: "最終的な育成・編成の判断は、利用者ご自身で行ってください。",
    analysisModeNote: "通常評価と辛口評価は表現の違いであり、計算結果そのものは変えません。",
    bestXiNote: "AIベスト11は、あなたの保存済み候補の中から決定的なルールで選出するものです。",
    bestXiPersonDedup: "同一の実在選手が複数の異なるカードにまたがる場合の重複判定は行っていません(既知の制約)。",
    bestXiPositionData: "副ポジション適性のデータは一部のカードでしか確認できません(既知の制約)。",
    draftNotice: "このページは現行実装に基づくベータ公開準備用の説明です。正式な法的助言や権利許諾の保証を行うものではありません。",
  },
  privacy: {
    pageTitle: "プライバシーポリシー(草案) | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIが現在取り扱うデータと保存場所についての説明(ベータ公開準備用の草案)です。",
    heading: "プライバシーポリシー(草案)",
    intro: "このページは、現行の実装で実際に取り扱っているデータだけを説明する、ベータ公開準備用の草案です。実装と異なる内容は記載していません。",
    draftNotice: "この草案は正式な法的文書ではありません。正式公開または課金開始の前に、運営者による最終確認と、必要に応じて法律・プライバシーの専門家確認が別途必要です。",
    dataStoredHeading: "現在ブラウザー内へ保存する可能性がある情報",
    dataStoredFavorites: "お気に入りに登録した選手",
    dataStoredMyTeam: "My Teamに登録した選手と所有状態",
    dataStoredOwnershipStatus: "選手ごとの所有・使用状況の設定",
    dataStoredSavedBuilds: "保存ビルド(育成配分の記録)",
    dataStoredAllocation: "育成ポイントの配分内容",
    dataStoredBuildIntent: "保存済みの育成目的(使用予定ポジション・優先度など)",
    dataStoredSavedSquads: "保存スカッド(編成内容)",
    dataStoredJsonImportContent: "JSONインポートで取り込んだ内容(取り込んだ場合のみ)",
    dataStoredUiSettings: "表示言語・サイドバーの開閉状態などの表示設定",
    dataNotStoredHeading: "現在保存していない情報(確認できた範囲)",
    dataNotStoredName: "氏名",
    dataNotStoredEmail: "メールアドレス",
    dataNotStoredAddress: "住所",
    dataNotStoredPhone: "電話番号",
    dataNotStoredPayment: "決済情報",
    dataNotStoredPassword: "パスワード",
    dataNotStoredAccount: "アカウント情報",
    dataNotStoredAiConversation: "生成AIとの会話内容",
    dataNotStoredFreeformOldInput: "分析用の自由記述の全文をサーバーへ保存すること",
    dataNotStoredDiagnosisPng: "作成した診断PNG画像そのもの",
    dataNotStoredBestXiResults: "AIベスト11の選出結果",
    storageLocationHeading: "保存場所",
    storageLocationBrowserOnly: "現在のユーザーデータは、お使いのブラウザー内(localStorage)に保存されます。",
    storageLocationNoServerAccount: "サーバー側のユーザーアカウントには紐付けていません。",
    storageLocationNoSync: "端末間・別ブラウザー間で自動的に同期しません。",
    storageLocationNoAutoMigration: "別のブラウザーへ自動的に移行することはありません。",
    storageLocationNoCloudBackup: "サーバー側でのクラウドバックアップは現在ありません。",
    storageLocationDeletionRisk: "ブラウザーのデータを削除すると、保存した内容を復元できない場合があります。",
    externalTransmissionHeading: "外部への送信について",
    externalTransmissionInAppApiIntro: "以下の処理は、アプリ自身のAPI(サーバー内の処理)と通信します。これは「アプリ内通信」であり、第三者の外部サービスへの送信ではありません。",
    externalTransmissionInAppApiWorldData: "選手・監督データの検索・取得(サーバー内のデータベースを参照します)",
    externalTransmissionInAppApiImageProxy: "選手画像の表示(サーバーが画像を取得して中継します)",
    externalTransmissionBrowserOnlyIntro: "以下は、ブラウザー内だけで完結し、サーバーへは送信されません。",
    externalTransmissionNoThirdParty: "第三者の外部サービス(決済・SNS連携等)へユーザーデータを送信することはありません。",
    externalTransmissionNoGenerativeAi: "生成AI・外部AI APIへ分析内容を送信することはありません。",
    externalTransmissionNoAnalytics: "現在、アクセス解析(Google Analytics等)は使用していません。",
    externalTransmissionNoAds: "現在、広告は表示していません。",
    cookieHeading: "Cookieについて",
    cookieBody: "現在、Cookieは使用していません(確認できた範囲)。",
    futureChangesHeading: "将来の変更について",
    futureChangesBody: "今後、認証・同期・決済・アクセス解析・監視などを導入する場合は、導入前にこのポリシーを更新します。",
    specialistReviewNotice: "この草案は、法令適合を保証するものではありません。正式公開または課金開始の前には、必要に応じてプライバシー・法律の専門家確認が別途必要です。",
  },
  terms: {
    pageTitle: "利用規約(草案) | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIの利用条件についての説明(ベータ公開準備用の草案)です。",
    heading: "利用規約(草案)",
    intro: "この利用規約は、現行の実装仕様に基づくベータ公開準備用の草案です。正式な法的文書ではなく、正式公開または課金開始の前に、運営者による最終確認と、必要に応じて法律の専門家確認が別途必要です。",
    draftNotice: "この草案は、現時点で提供されている機能だけを対象としています。将来実装予定の機能(アカウント・決済等)についての規定は含みません。",
    section1Heading: "1. 適用",
    section1Body: "この規約は、eFootball Team AI(以下「本サービス」)の利用に関する条件を定めるものです。本サービスを利用した時点で、この規約(草案)の内容に同意したものとして扱います。",
    section2Heading: "2. サービス内容",
    section2Body: "本サービスは、選手データの閲覧・育成計算・チーム編成の検討を支援する非公式ツールです。提供する機能は「サービス概要」ページで説明する範囲に限られ、現時点でアカウント登録・課金機能はありません。",
    section3Heading: "3. 利用条件",
    section3Body: "本サービスは、ブラウザーのみで動作し、現時点で年齢制限・登録手続きはありません。ユーザーは自己の判断と責任で本サービスを利用するものとします。",
    section4Heading: "4. 禁止事項",
    section4Intro: "本サービスの利用にあたり、以下の行為を禁止します。",
    section4ProhibitUnauthorizedAccess: "本サービスへの不正アクセス",
    section4ProhibitVulnerabilityAbuse: "脆弱性を悪用する行為",
    section4ProhibitDataTheft: "他者のデータを不正に取得する行為",
    section4ProhibitRightsInfringement: "他者の権利を侵害する行為",
    section4ProhibitExcessiveLoad: "システムへ過度な負荷を与える行為",
    section4ProhibitMaliciousJsonOrScript: "不正なJSONやスクリプトを悪用する行為",
    section4ProhibitMisrepresentAsOfficial: "本サービスを公式サービスであるかのように誤認させる形での再配布",
    section4ProhibitUnlawfulUse: "法令または公序良俗に反する利用",
    section5Heading: "5. ユーザーが入力または保存するデータ",
    section5Body: "本サービスでユーザーが入力・保存するデータ(My Team・保存ビルド・保存スカッド等)は、現在お使いのブラウザー内にのみ保存されます。詳細は「プライバシーポリシー」「データ管理」ページをご確認ください。",
    section6Heading: "6. 分析結果の性質",
    section6Body: "本サービスの分析結果(育成計算・Build Analysis・スカッド診断・AIベスト11等)は、確認可能なデータと決定的なルールに基づく参考情報です。ゲーム公式の評価ではなく、勝率・試合結果・選手の実際の使用感を保証するものではありません。詳細は「免責事項」ページをご確認ください。",
    section7Heading: "7. 知的財産",
    section7Body: "本サービス自体の実装・デザインに関する権利は開発者に帰属します。選手名・カード名・クラブ名・関連データ・画像等の第三者に由来する要素の権利は、それぞれの権利者に帰属します。本サービスはそれらの公式ライセンス製品ではありません。",
    section8Heading: "8. 第三者サービス・第三者データ",
    section8Body: "本サービスが参照する選手・監督データおよび画像は、第三者が提供する情報を参照しています。本サービスはこれらのデータの正確性・最新性を保証しません。詳細は「免責事項」ページをご確認ください。",
    section9Heading: "9. サービス変更・停止",
    section9Body: "運営上・技術上の理由により、事前の予告なく本サービスの内容を変更、または提供を停止する場合があります。",
    section10Heading: "10. 免責",
    section10Body: "本サービスの利用により生じたいかなる損害についても、法令上許容される範囲で、運営者は責任を負わないものとします。分析結果を利用した育成・編成の最終判断は、利用者ご自身の責任で行ってください。",
    section11Heading: "11. 利用停止",
    section11Body: "本サービスは現時点でアカウント登録・投稿機能を持たないため、個別ユーザーの利用停止措置に関する詳細な規定は設けていません。禁止事項に該当する行為が確認された場合、本サービスへのアクセスを技術的に制限する場合があります。",
    section12Heading: "12. 規約変更",
    section12Body: "この規約(草案)は、正式公開に向けて内容を変更する場合があります。重要な変更がある場合は、本サービス内で分かる形にする予定です。",
    section13Heading: "13. 問い合わせ・準拠法・管轄",
    section13Body: "問い合わせ先は「問い合わせ」ページをご確認ください。準拠法・裁判管轄については、運営者による確認が完了していないため、この草案では定めていません。",
    ownerConfirmationNotice: "準拠法・裁判管轄・正式な事業者名・所在地は、運営者による確認が完了していないため、この草案には記載していません。公開前に運営者が確認・追記する必要があります。",
  },
  dataManagement: {
    pageTitle: "データ管理 | eFootball Team AI",
    pageDescriptionMeta: "保存データの保存場所・バックアップ方法・削除方法についての説明ページです。",
    heading: "データ管理",
    intro: "このページでは、現在どのデータがどこに保存されるか、削除するとどうなるか、バックアップの方法を説明します。",
    draftNotice: "この説明は現行実装に基づくベータ公開準備用の草案です。",
    storedDataHeading: "保存されるデータ",
    storedDataBody: "お気に入り・My Team・保存ビルド(育成配分・保存済み育成目的を含む)・保存スカッド・スカッドテンプレート・表示設定は、現在お使いのブラウザーのlocalStorageへ保存されます。",
    browserRiskHeading: "ブラウザーデータ削除時の影響",
    browserRiskBody: "ブラウザーの設定からデータ(閲覧履歴・サイトデータ等)を削除すると、保存した内容を復元できない場合があります。",
    browserRiskSameDeviceDifferentBrowser: "同じパソコンでも、別のブラウザーでは別のデータとして扱われます。",
    browserRiskPrivateMode: "シークレットモード・プライベートブラウジングでは、ウィンドウを閉じると保存内容が維持されない場合があります。",
    browserRiskBrowserSettings: "ブラウザーの設定によっては、一定期間でサイトデータが自動的に削除される場合があります。",
    noSyncNoCloudBody: "端末間の自動同期・クラウドバックアップは現在ありません。別の端末や別のブラウザーへ自動的に引き継がれることはありません。",
    jsonBackupHeading: "JSONバックアップ",
    jsonBackupBody: "保存ビルドは、JSON形式でエクスポート(書き出し)・インポート(読み込み)できます。",
    jsonBackupWhereBody: "エクスポート・インポートは「My Builds」または「保存ビルド一覧」の画面から行えます。",
    jsonBackupTimingRecommendation: "重要な保存ビルドを作成・更新したときは、こまめにJSONバックアップを取ることをおすすめします。",
    jsonBackupContentWarning: "JSONファイルには保存ビルドの内容(育成配分・保存済み育成目的等)が含まれる場合があります。",
    jsonBackupSharingWarning: "バックアップしたJSONファイルは、安全な場所へ保管し、不特定多数へ公開しないようにしてください。",
    jsonBackupImportWarning: "出所が分からないJSONファイルを安易にインポートしないでください。",
    howToDeleteHeading: "個別データの削除方法",
    howToDeleteBuild: "保存ビルドの削除: 「My Builds」または「保存ビルド一覧」の各ビルドから削除できます。",
    howToDeleteMyTeam: "My Teamからの削除: 「My Team」の各選手のメニューから削除・所有状態の変更ができます。",
    howToDeleteSquad: "保存スカッドの削除: 「スカッド」一覧の各スカッドから削除できます。",
    howToDeleteIntentOnly: "保存済み育成目的だけの削除: 保存ビルドの編集画面で、育成目的の設定を破棄できます(ビルド自体は残ります)。",
    deleteAllHeading: "ローカルデータをすべて削除",
    deleteAllIntro: "このブラウザーに保存している本サービスのデータをまとめて削除します。SQLite(選手・監督データ)や、本サービス以外のサイトのデータには影響しません。",
    deleteAllTargetHeading: "削除される対象",
    deleteAllTargetFavorites: "お気に入り",
    deleteAllTargetMyTeam: "My Team",
    deleteAllTargetBuilds: "保存ビルド(保存済み育成目的を含む)",
    deleteAllTargetSquads: "保存スカッド",
    deleteAllTargetTemplates: "スカッドテンプレート",
    deleteAllTargetEditorPrefs: "スカッド編集の表示設定",
    deleteAllTargetComparisonState: "スカッド比較の一時状態",
    deleteAllExcludedNote: "表示言語の設定・サイドバーの開閉状態は削除されません。",
    deleteAllNothingToDelete: "現在、削除できるデータはありません。",
    deleteAllStartButton: "ローカルデータをすべて削除する",
    deleteAllConfirmTitle: "本当にすべて削除しますか？",
    deleteAllConfirmBody: "この操作は取り消せません。上に表示した対象のデータがすべて削除されます。",
    deleteAllConfirmButton: "削除する",
    deleteAllCancelButton: "キャンセル",
    deleteAllBackupReminder: "削除する前に、必要な保存ビルドをJSONでバックアップすることをおすすめします。",
    deleteAllInProgress: "削除しています…",
    deleteAllSuccessMessage: "ローカルデータを削除しました。",
    deleteAllFailureMessage: "削除に失敗しました。ブラウザーの設定をご確認のうえ、再度お試しください。",
    deleteAllPartialFailureMessage: "一部のデータの削除に失敗しました。ページを再読み込みしてから、もう一度お試しください。",
    deleteAllStorageUnavailable: "この環境ではブラウザー保存機能を利用できないため、削除できるデータがありません。",
  },
  support: {
    pageTitle: "問い合わせ | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIへの問い合わせ・不具合報告・権利者からの連絡についての案内ページです。",
    heading: "問い合わせ",
    intro: "本サービスに関するお問い合わせ・不具合報告の窓口についてご案内します。",
    draftNotice: "この案内は現行実装に基づくベータ公開準備用の草案です。",
    notConfiguredNotice: "問い合わせ窓口は公開前準備中です。",
    sharedChannelIntro: "現在、一般問い合わせ、不具合報告、権利者からの連絡、プライバシーに関する問い合わせは、共通の窓口で受け付けています。",
    sharedChannelEmailLabel: "問い合わせ先メールアドレス",
    sendMailButtonLabel: "メールを送る",
    mailtoAriaGeneral: "一般問い合わせ用のメールを送る",
    mailtoAriaBugReport: "不具合報告用のメールを送る",
    mailtoAriaRights: "権利者からの連絡用のメールを送る",
    mailtoAriaPrivacy: "プライバシー問い合わせ用のメールを送る",
    mailtoSubjectGeneral: "eFootball Team AI 一般問い合わせ",
    mailtoSubjectBugReport: "eFootball Team AI 不具合報告",
    mailtoSubjectRights: "eFootball Team AI 権利に関する連絡",
    mailtoSubjectPrivacy: "eFootball Team AI プライバシー問い合わせ",
    safetyNoticeHeading: "問い合わせ時のご注意",
    safetyNoPassword: "パスワードを送らないでください。",
    safetyNoAuthCode: "認証コードを送らないでください。",
    safetyNoRecoveryCode: "回復コードを送らないでください。",
    safetyNoPaymentInfo: "決済情報を送らないでください。",
    safetyNoUnnecessaryPersonalInfo: "不必要な個人情報を送らないでください。",
    generalContactHeading: "一般的なお問い合わせ",
    generalContactIntro: "一般的なお問い合わせや不具合報告はこちらへお送りください。",
    generalContactUnset: "現在、一般的なお問い合わせの窓口は準備中です。",
    generalContactEmailLabel: "問い合わせメール",
    bugReportHeading: "不具合報告",
    bugReportIntro: "不具合を報告する際は、可能な範囲で次の情報をお知らせください。",
    bugReportFieldPage: "発生したページ",
    bugReportFieldSteps: "操作手順",
    bugReportFieldExpected: "期待した結果",
    bugReportFieldActual: "実際の結果",
    bugReportFieldBrowser: "使用しているブラウザー",
    bugReportFieldWidth: "画面幅(PC・スマートフォン等)",
    bugReportFieldErrorMessage: "表示されたエラーメッセージ(あれば)",
    bugReportNoPersonalData: "個人情報や内部データは含めないでください。",
    bugReportNoUnsolicitedJsonAttachment: "求められていない限り、JSONバックアップファイルを添付しないでください。",
    bugReportCheckScreenshot: "スクリーンショットを送る場合は、個人情報が写り込んでいないかご確認ください。",
    issueTrackerLabel: "不具合報告(Issue Tracker)",
    rightsHolderHeading: "権利者の方からのご連絡",
    rightsHolderIntro: "選手名・カード・データ・画像等について、権利をお持ちの方からのご連絡は、次の情報とあわせてお送りいただけますようお願いいたします。",
    rightsHolderContactIntro: "掲載内容、データ、画像、権利に関するご連絡はこちらへお送りください。",
    rightsHolderFieldContent: "対象のコンテンツ",
    rightsHolderFieldUrl: "該当するURL",
    rightsHolderFieldRightType: "権利の種類",
    rightsHolderFieldContactInfo: "ご連絡者様の情報",
    rightsHolderFieldRequestedAction: "削除または修正のご希望内容",
    rightsHolderFieldEvidence: "確認資料(あれば)",
    rightsHolderFieldReplyTo: "返信先",
    rightsHolderUnsetNotice: "現在、権利者専用の窓口は準備中です。上記の一般的なお問い合わせ先が設定され次第、そちらへご連絡ください。",
    rightsHolderEmailLabel: "権利者専用連絡先",
    privacyContactHeading: "プライバシーに関するお問い合わせ",
    privacyContactIntro: "プライバシーやローカルデータの取り扱いに関するご連絡はこちらへお送りください。",
    privacyContactUnsetNotice: "現在、プライバシー専用の問い合わせ窓口は準備中です。",
    privacyContactEmailLabel: "プライバシー問い合わせ先",
    noSubmissionFormNotice: "この画面は送信フォームではなく、案内表示専用です。上記の連絡先が設定されている場合は、そちらへ直接ご連絡ください。",
  },
  releaseReadiness: {
    pageTitle: "公開準備状況 | eFootball Team AI",
    pageDescriptionMeta: "eFootball Team AIの現在の提供段階と、公開前に必要な残作業をまとめたページです。",
    heading: "公開準備状況",
    intro: "このページでは、本サービスが現在どの提供段階にあるか、正直にお伝えします。",
    currentStageHeading: "現在の提供段階",
    currentStageBody: "現在はローカル開発版から身内限定テストへ向けた公開準備段階です。認証・端末間同期・決済は未実装であり、一般公開はまだできません。",
    availableHeading: "利用可能な機能",
    betaHeading: "ベータ機能(既知の制約あり)",
    notProvidedHeading: "未提供の機能",
    dataCautionHeading: "データに関する注意",
    dataCautionBody: "ユーザーデータは現在ブラウザー内にのみ保存されます。端末間同期・クラウドバックアップはありません。詳しくは「データ管理」ページをご確認ください。",
    knownLimitationsHeading: "既知の制約",
    limitationBestXiDedup: "AIベスト11は、同一の実在選手が複数カードにまたがる重複を判定しません。",
    limitationSubPosition: "副ポジション適性のデータは一部のカードでしか確認できません。",
    limitationRuleBasedNotOfficial: "分析はルールベースであり、ゲーム公式の評価ではありません。",
    noGenerativeAiNotice: "生成AI・外部AI APIは使用していません。",
    notOfficialNotice: "本サービスはeFootballの公式サービスではありません。",
    contactStatusHeading: "問い合わせ窓口の状況",
    contactStatusUnset: "現在、問い合わせ窓口は準備中です。",
    checklistHeading: "公開準備チェック",
    checklistIntro: "次の各項目は、一般公開までに必要な準備状況をまとめたものです。",
    statusComplete: "完了",
    statusPartial: "一部完了",
    statusNotStarted: "未着手",
    statusNotApplicable: "対象外",
    statusRequiresOwnerAction: "運営者の対応が必要",
    statusRequiresSpecialistReview: "専門家確認が必要",
    blockingLocalOnly: "ローカル開発のみ",
    blockingInternalTestBlocker: "身内限定テストの障害",
    blockingInviteBetaBlocker: "招待制ベータの障害",
    blockingPublicBetaBlocker: "一般ベータ公開の障害",
    blockingProductionBlocker: "正式公開の障害",
    blockingPaidPlanBlocker: "Pro課金開始の障害",
    itemAuthTitle: "認証",
    itemAuthDesc: "ユーザーごとのログイン機構は未実装です。",
    itemDataIsolationTitle: "ユーザー別データ分離",
    itemDataIsolationDesc: "アカウントの概念が無いため、ユーザーごとのデータ分離は未実装です。",
    itemSyncTitle: "端末間同期",
    itemSyncDesc: "別端末・別ブラウザーへの自動同期は未実装です。",
    itemCloudBackupTitle: "クラウドバックアップ",
    itemCloudBackupDesc: "サーバー側でのユーザーデータの自動バックアップは未実装です。",
    itemLocalBackupTitle: "JSONバックアップ",
    itemLocalBackupDesc: "保存ビルドはJSON形式で手動エクスポート・インポートできます。",
    itemDataDeletionTitle: "データ削除機能",
    itemDataDeletionDesc: "個別データの削除、およびローカルデータの一括削除機能を提供しています。",
    itemTermsTitle: "利用規約",
    itemTermsDesc: "現行実装に基づく草案を公開しています。準拠法・裁判管轄は運営者確認待ちです。",
    itemPrivacyTitle: "プライバシーポリシー",
    itemPrivacyDesc: "現行実装に基づく草案を公開しています。",
    itemDisclaimerTitle: "免責事項",
    itemDisclaimerDesc: "分析結果の性質・非公式であることの説明を公開しています。",
    itemUnofficialNoticeTitle: "非公式サービス表記",
    itemUnofficialNoticeDesc: "フッター・サービス概要・免責事項に非公式である旨を表示しています。",
    itemRightsCheckTitle: "第三者データ・画像の権利確認",
    itemRightsCheckDesc: "選手・監督データや画像の出典元に、再配布を明示的に許諾する文書は確認できていません。専門家確認が必要です。",
    itemSupportContactTitle: "問い合わせ窓口",
    itemSupportContactDesc: "一般問い合わせ・不具合報告・プライバシー問い合わせを受け付ける連絡先(初期段階では共通の窓口)。",
    itemRightsContactTitle: "権利者専用連絡窓口",
    itemRightsContactDesc: "権利者(選手・カード・データ・画像等の権利保持者)からの連絡を受け付ける連絡先(初期段階では上記と共通の窓口)。",
    itemHostingTitle: "本番ホスティング",
    itemHostingDesc: "現在はローカル開発サーバーのみで、本番ホスティングは未整備です。",
    itemMonitoringTitle: "監視体制",
    itemMonitoringDesc: "稼働監視の仕組みは未整備です。",
    itemErrorCollectionTitle: "エラー収集",
    itemErrorCollectionDesc: "エラー監視サービスは未導入です。",
    itemSecurityTitle: "セキュリティレビュー",
    itemSecurityDesc: "認証が無い前提での基本的な入力検証は行っていますが、正式なセキュリティレビューは未実施です。",
    itemOperatingCostTitle: "運用費試算",
    itemOperatingCostDesc: "本番運用時の費用試算は未実施です。",
    itemFreeProDesignTitle: "無料/Pro設計",
    itemFreeProDesignDesc: "料金プランの設計は未着手です。",
    itemBillingTitle: "決済",
    itemBillingDesc: "決済機能は未実装です。",
    itemCancellationTitle: "解約・返金方針",
    itemCancellationDesc: "解約・返金に関する方針は未策定です。",
    itemSupportStructureTitle: "サポート体制",
    itemSupportStructureDesc: "継続的な利用者サポート体制は未整備です。",
    draftNotice: "このページの内容は現行実装に基づく確認結果です。正式公開に向けた最終判断は運営者が行う必要があります。",
  },
  auth: {
    navSignIn: "ログイン",
    navSignUp: "新規登録",
    navAccount: "アカウント",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    passwordConfirmLabel: "パスワード（確認用）",
    passwordRequirementsHint: "12文字以上で、英大文字・英小文字・数字・記号をすべて含めてください。",
    passwordMismatchError: "パスワードが一致しません。",
    invalidEmailError: "メールアドレスの形式が正しくありません。",
    genericErrorMessage: "処理に失敗しました。時間をおいて再度お試しください。",
    tryAgainMessage: "もう一度お試しください。",
    processingAuthMessage: "認証を処理しています…",
    checkingSessionMessage: "ログイン状態を確認しています…",
    signUpPageTitle: "新規登録",
    signUpSubmitButton: "登録する",
    signUpSuccessTitle: "確認メールを送信しました",
    signUpSuccessMessage: "ご登録いただいたメールアドレスに確認メールを送信しました。メール内のリンクを開いて登録を完了してください。",
    signUpFailedMessage: "登録に失敗しました。入力内容を確認し、もう一度お試しください。",
    signUpHaveAccountPrompt: "すでにアカウントをお持ちの方",
    signUpSignInLink: "ログインはこちら",
    signInPageTitle: "ログイン",
    signInSubmitButton: "ログイン",
    signInFailedMessage: "メールアドレスまたはパスワードが正しくありません。",
    signInNoAccountPrompt: "アカウントをお持ちでない方",
    signInSignUpLink: "新規登録はこちら",
    signInForgotPasswordLink: "パスワードをお忘れですか？",
    logoutButton: "ログアウト",
    logoutProcessingMessage: "ログアウトしています…",
    forgotPasswordPageTitle: "パスワードをお忘れの方",
    forgotPasswordDescription: "ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。",
    forgotPasswordSubmitButton: "再設定メールを送信",
    forgotPasswordSentMessage: "入力いただいたメールアドレス宛にパスワード再設定用のメールを送信しました（該当するアカウントが存在する場合）。メールをご確認ください。",
    updatePasswordPageTitle: "新しいパスワードを設定",
    updatePasswordDescription: "新しいパスワードを入力してください。",
    updatePasswordSubmitButton: "パスワードを更新",
    updatePasswordSuccessMessage: "パスワードを更新しました。新しいパスワードで再度ログインしてください。",
    callbackProcessingMessage: "認証情報を確認しています…",
    callbackFailedMessage: "認証の確認に失敗しました。もう一度ログインまたは登録をお試しください。",
    callbackReturnLink: "ログイン画面へ戻る",
    accountPageTitle: "アカウント",
    accountLoginRequiredMessage: "この画面を利用するにはログインが必要です。",
    accountLoggedInLabel: "ログイン中",
    accountEmailLabel: "確認済みメールアドレス",
    accountCloudSyncNoticeTitle: "クラウド同期は未実装です",
    accountCloudSyncNoticeDesc: "現在、このアカウントはログイン機能の技術検証段階です。My Team・お気に入り・保存済みビルド・保存済みスカッドなどのクラウド同期はまだ利用できません。",
    accountLocalDataNoticeDesc: "My Team・お気に入り・保存済みビルド・保存済みスカッドなどのデータは、引き続きこの端末のブラウザー内（ローカル）にのみ保存されます。",
    accountNoAutoUploadNoticeDesc: "ログインしても、この端末に保存されているローカルデータが自動的にアップロードされることはありません。",
    accountCrossDeviceNoticeDesc: "別の端末やブラウザーとのデータ同期には現時点で対応していません。",
    accountDeletionFutureNoticeDesc: "アカウントの削除機能は今後のフェーズで提供予定です。",
    signUpNextStepsHeading: "次に行うこと",
    signUpStep1: "登録したメールアドレスの受信箱を確認してください。",
    signUpStep2: "eFootball Team AIから届いた確認メールを開いてください。",
    signUpStep3: "メール内の確認リンクを押してください。",
    signUpStep4: "確認が完了したら、ログイン画面またはアカウント画面へ進んでください。",
    signUpGoToSignInButton: "ログイン画面へ進む",
    signUpSpamFolderNotice: "メールが見当たらない場合は、迷惑メールフォルダーもご確認ください。",
    signUpAlreadyConfirmedNotice: "メールアドレスの確認がすでに完了している場合は、そのままログインできます。",
    signUpEmailNotArrivingNotice: "しばらく待ってもメールが届かない場合は、確認メールを再送信できます。",
    localDevConfirmationNotice:
      "現在はローカル開発環境です。確認メールのリンクは、このサイトを起動しているWindows PCで開いてください。スマートフォンなど別の端末でlocalhostのリンクを開くと、開発中のサイトへ接続できません。",
    resendConfirmationButton: "確認メールを再送信",
    resendConfirmationSending: "送信中…",
    resendConfirmationSuccessMessage: "確認メールを再送信しました。メールが届くまで少し時間がかかる場合があります。",
    resendConfirmationRateLimitedMessage: "短時間に複数回送信されたため、現在は再送信できません。しばらく待ってからもう一度お試しください。",
    resendConfirmationFailedMessage: "確認メールの再送信に失敗しました。時間をおいてもう一度お試しください。",
    resendConfirmationWaitTemplate: "再送信まであと{seconds}秒",
  },
};

export default ja;
