export { SMLogo, type SMLogoSize } from './SMLogo';
export { SMButton, type SMButtonProps, type SMButtonVariant, type SMButtonSize } from './SMButton';
export { SMTextInput, type SMTextInputProps } from './SMTextInput';
export { SMPasswordInput, type SMPasswordInputProps } from './SMPasswordInput';
export { SMOTPInput, type SMOTPInputProps } from './SMOTPInput';
export { SMCard, type SMCardProps } from './SMCard';
export { SMHeader, type SMHeaderProps } from './SMHeader';
export { SMInlineNotice, type SMInlineNoticeProps, type SMNoticeType } from './SMInlineNotice';
export { SMAuthContainer, type SMAuthContainerProps } from './SMAuthContainer';
export { SMAuthFooter, type SMAuthFooterProps } from './SMAuthFooter';
export { SMProfileBadge, type SMProfileBadgeProps } from './SMProfileBadge';
export { SMNavbar, type SMNavbarProps } from './SMNavbar';
export { SMMobileDrawer, type SMMobileDrawerProps, type DrawerRoute } from './SMMobileDrawer';
export { SMSearchInput, type SMSearchInputProps } from './SMSearchInput';
export { SMFilterTabs, type SMFilterTabsProps, type GroupFilterType, type FilterOption } from './SMFilterTabs';
export { SMGroupCard, type SMGroupCardProps } from './SMGroupCard';
export { SMGroupSkeletonCard, SMGroupSkeletonList } from './SMGroupSkeleton';
export { SMEmptyState, type SMEmptyStateProps } from './SMEmptyState';
export { SMErrorState, type SMErrorStateProps } from './SMErrorState';

/* ---- Group Detail (Phase 3) ---- */
export { SMSheet, type SMSheetProps } from './SMSheet';
export { SMActionSheet, type SMActionSheetProps, type SMAction } from './SMActionSheet';
export { SMConfirmSheet, type SMConfirmSheetProps } from './SMConfirmSheet';
export { SMGroupHero, type SMGroupHeroProps } from './SMGroupHero';
export { SMSegmentedNav, type SMSegmentedNavProps, type SMSegmentOption } from './SMSegmentedNav';
export { SMExpenseListItem, type SMExpenseListItemProps } from './SMExpenseListItem';
export {
  SMAvatarStack,
  SMSectionHeader,
  type SMAvatarStackProps,
  type SMAvatarStackPerson,
} from './SMAvatarStack';
export { SMGroupDetailSkeleton, SMRowSkeleton } from './SMGroupDetailSkeleton';
export {
  SMSettlementListItem,
  type SMSettlementListItemProps,
  type SMSettlementTone,
  type SMChip,
} from './SMSettlementListItem';
export { SMActivityRow, type SMActivityRowProps, type SMActivityTone } from './SMActivityRow';
export { SMBadge, type SMBadgeProps, type SMBadgeTone } from './SMBadge';

/* ---- Expense ledger (Phase 4) ---- */
export { SMAmount, type SMAmountProps, type SMAmountSize, type SMAmountTone } from './SMAmount';
export { SMDateHeader, type SMDateHeaderProps } from './SMDateHeader';
export { SMDetailRow, type SMDetailRowProps } from './SMDetailRow';
export { SMFilterChip, type SMFilterChipProps } from './SMFilterChip';

/* ---- Forms & media (Phase 5) ---- */
export {
  SMImagePicker,
  type SMImagePickerProps,
  type SMImagePickerVariant,
} from './SMImagePicker';
export { SMAmountInput, type SMAmountInputProps } from './SMAmountInput';
export { SMSelectField, type SMSelectFieldProps } from './SMSelectField';
export { SMDateField, type SMDateFieldProps } from './SMDateField';
export {
  SMScreenHeader,
  type SMScreenHeaderProps,
  type SMScreenHeaderAction,
} from './SMScreenHeader';
export {
  SMExpenseFilterSheet,
  type SMExpenseFilterSheetProps,
  type SMFilterGroup,
  type SMFilterOption,
} from './SMExpenseFilterSheet';
export { SMAvatar, type SMAvatarProps } from './SMAvatar';
export { SMOptionRow, type SMOptionRowProps } from './SMOptionRow';
export {
  SMPersonBalanceRow,
  type SMPersonBalanceRowProps,
} from './SMPersonBalanceRow';

/* ---- Settlements (Phase 8) ---- */
export {
  SMSettlementStatus,
  settlementStatusLabel,
  type SMSettlementStatusProps,
  type SMSettlementStatusValue,
} from './SMSettlementStatus';
export { SMChoiceCard, type SMChoiceCardProps } from './SMChoiceCard';
export { SMSettlementParties, type SMSettlementPartiesProps } from './SMSettlementParties';
export {
  SMTimeline,
  type SMTimelineProps,
  type SMTimelineStep,
  type SMTimelineStepState,
} from './SMTimeline';
export { SMImageViewer, type SMImageViewerProps } from './SMImageViewer';
export { SMChipFilter, type SMChipFilterProps, type SMChipFilterOption } from './SMChipFilter';

/* ---- Notifications (Phase 10) ---- */
export {
  SMNotificationItem,
  type SMNotificationItemProps,
  type SMNotificationKind,
} from './SMNotificationItem';
export { SMToggleRow, type SMToggleRowProps } from './SMToggleRow';

/* ---- Search (Phase 11) ---- */
export { SMSearchResult, SMSearchIcon, type SMSearchResultProps } from './SMSearchResult';

/* ---- AI (Phase 11) ---- */
export {
  SMAiText,
  SMAiTyping,
  SMAiUserMessage,
  SMAiAssistantMessage,
  SMAiSourceCard,
  SMAiSuggestion,
  SMAiComposer,
} from './SMAi';

/* ---- Settings & security (Phase 13) ---- */
export { SMSettingsGroup, SMSettingsRow, type SMSettingsRowProps } from './SMSettings';
