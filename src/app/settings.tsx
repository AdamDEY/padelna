import { router, useNavigation, usePreventRemove } from "expo-router";
import {
  Button,
  FieldError,
  Input,
  Label,
  PressableFeedback,
  Select,
  Spinner,
  TextArea,
  TextField,
  useToast,
} from "heroui-native";
import { Lock, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Text, View } from "react-native";

import { DeleteAccountSheet } from "@/components/delete-account-sheet";
import { Dropdown } from "@/components/dropdown";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { PhotoPicker } from "@/components/photo-picker";
import { PlayerAvatar } from "@/components/player-avatar";
import { SegmentedControl } from "@/components/segmented-control";
import {
  SettingsFieldLabel,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from "@/components/settings-section";
import type { Hand, PlayStyle, Side } from "@/components/setup-game-step";
import { LANGUAGE_NAMES, LANGUAGES, setLanguage, type Language } from "@/i18n";
import { cities, me, myProfile, upcomingMatches } from "@/data/mock";
import { useClubs } from "@/hooks/useClubs";
import { useMyClubs } from "@/hooks/usePlayers";
import { myProfileKey, useMyAccount } from "@/hooks/useMyProfile";
import {
  askForPushNotifications,
  useNotificationSettings,
  usePushPermission,
  useSaveNotificationSettings,
} from "@/hooks/usePushNotifications";
import { queryClient } from "@/lib/query-client";
import { deleteOwnAccount } from "@/repositories/auth-repository";
import { updateProfile } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";
import { errorMessage } from "@/lib/error-message";

const BIO_MAX_LENGTH = 150;
const cityOptions = cities.map((city) => ({ value: city, label: city }));

// A match you host would be cancelled if you delete your account
const hostedMatch = upcomingMatches.find((match) => match.host.id === me.id);

/** Edit profile and settings, opened from the Profile hero's top-right button. */
export default function Settings() {
  const { t } = useTranslation();
  const { data: account, error, refetch, isRefetching } = useMyAccount();

  if (!account) {
    return (
      <Page underStatusBar>
        <Page.Header bar back leading={<Text className="font-black text-[20px] text-foreground">{t("settings.title")}</Text>} />
        <Page.Body scroll={false} className="items-center justify-center gap-3">
          {error ? (
            <>
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.loadFailed")}
              </Text>
              <Text className="text-center font-normal text-[14px] text-muted">{errorMessage(error)}</Text>
              <Button variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
                {t("matches.tryAgain")}
              </Button>
            </>
          ) : (
            <Spinner accessibilityLabel={t("profile.loading")} />
          )}
        </Page.Body>
      </Page>
    );
  }

  return <SettingsForm account={account} />;
}

/** The form itself; it starts from the saved profile, so it only mounts once that has loaded. */
function SettingsForm({ account }: { account: MyAccount }) {
  const { t } = useTranslation();
  const handOptions: { value: Hand; label: string }[] = [
    { value: "right", label: t("settings.handRight") },
    { value: "left", label: t("settings.handLeft") },
  ];
  const sideOptions: { value: Side; label: string }[] = [
    { value: "left", label: t("settings.handLeft") },
    { value: "right", label: t("settings.handRight") },
    { value: "both", label: t("settings.sideBoth") },
  ];
  const playStyleOptions: { value: PlayStyle; label: string }[] = [
    { value: "aggressive", label: t("playStyle.aggressive") },
    { value: "balanced", label: t("playStyle.balanced") },
    { value: "defensive", label: t("playStyle.defensive") },
    { value: "tactical", label: t("playStyle.tactical") },
  ];
  const { toast } = useToast();
  const navigation = useNavigation();
  const [photoUri, setPhotoUri] = useState<string>();
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [city, setCity] = useState(account.city);
  const [bio, setBio] = useState(account.bio);
  const [hand, setHand] = useState<Hand>(account.hand);
  const [side, setSide] = useState<Side>(account.side);
  const [playStyle, setPlayStyle] = useState<PlayStyle>(account.playStyle);
  const { data: myClubs = [] } = useMyClubs();
  const { data: allClubs = [] } = useClubs();
  // Until you add or remove one, the list is the clubs you've played at
  const [editedClubs, setEditedClubs] = useState<string[]>();
  const clubs = editedClubs ?? myClubs.map((club) => club.name);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Leaving after a save, log out or delete must not trigger the discard warning, so the
  // navigation runs in an effect once the warning has been switched off
  const [leaving, setLeaving] = useState<"back" | "sign-in">();

  const hasChanges =
    photoUri !== undefined ||
    firstName !== account.firstName ||
    lastName !== account.lastName ||
    city !== account.city ||
    bio !== account.bio ||
    hand !== account.hand ||
    side !== account.side ||
    playStyle !== account.playStyle;

  usePreventRemove(hasChanges && leaving === undefined, ({ data }) => {
    Alert.alert(t("settings.discardTitle"), t("settings.discardText"), [
      { text: t("settings.keepEditing"), style: "cancel" },
      { text: t("settings.discard"), style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const firstNameError = submitted && firstName.trim() === "";
  const lastNameError = submitted && lastName.trim() === "";

  async function save() {
    setSubmitted(true);
    if (!firstName.trim() || !lastName.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile(account.id, { firstName, lastName, city, bio, hand, side, playStyle, photoUri });
      await queryClient.invalidateQueries({ queryKey: myProfileKey });
      toast.show({ variant: "success", label: t("settings.saved") });
      setLeaving("back");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("settings.saveFailed"),
        description: errorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  // The account rows open their own screens once those exist
  function comingSoon(label: string) {
    toast.show({ label, description: t("myMatch.comingSoon") });
  }

  function leaveToSignIn() {
    // The next player to sign in on this device must not see this profile
    queryClient.clear();
    setLeaving("sign-in");
  }

  useEffect(() => {
    if (leaving === "back") {
      router.back();
    } else if (leaving === "sign-in") {
      router.dismissAll();
      router.replace("/sign-in");
    }
  }, [leaving]);

  async function deleteAccount() {
    try {
      await deleteOwnAccount();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("settings.deleteFailed"),
        description: errorMessage(error),
      });
      return;
    }
    setIsDeleteOpen(false);
    toast.show({ label: t("settings.deleted"), description: t("settings.sorry") });
    leaveToSignIn();
  }

  return (
    <Page underStatusBar>
      <Page.Header
        bar
        back
        leading={
          <Text
            accessibilityRole="header"
            className="font-black text-[20px] tracking-[-0.3px] text-foreground"
          >
            {t("settings.title")}
          </Text>
        }
      >
        <Button size="sm" onPress={save} isDisabled={isSaving} className="h-10 rounded-xl px-4">
          {t("settings.save")}
        </Button>
      </Page.Header>

      <Page.Body className="gap-[22px]">
        <PhotoPicker
          uri={photoUri}
          onChange={setPhotoUri}
          current={
            <PlayerAvatar
              player={{
                id: account.id,
                firstName: account.firstName,
                lastName: account.lastName,
                avatarUrl: account.avatarUrl,
              }}
              size={92}
            />
          }
        />

        <SettingsSection title={t("settings.aboutYou")} layout="form">
          <View className="flex-row gap-2.5">
            <TextField isInvalid={firstNameError} className="flex-1">
              <Label>{t("settings.firstName")}</Label>
              <Input
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                textContentType="givenName"
              />
              <FieldError>{t("settings.firstNameError")}</FieldError>
            </TextField>
            <TextField isInvalid={lastNameError} className="flex-1">
              <Label>{t("settings.lastName")}</Label>
              <Input
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                textContentType="familyName"
              />
              <FieldError>{t("settings.lastNameError")}</FieldError>
            </TextField>
          </View>

          <View className="gap-1.5">
            <Text className="font-semibold text-[14px] text-foreground">{t("settings.city")}</Text>
            <Dropdown
              label={t("settings.city")}
              placeholder={t("settings.chooseCity")}
              options={cityOptions}
              value={cityOptions.find((option) => option.value === city)}
              onChange={(option) => option && setCity(option.value)}
            />
          </View>

          <TextField>
            <View className="flex-row items-baseline justify-between">
              <Label>{t("settings.bio")}</Label>
              <Text className="font-normal text-[12px] text-muted">
                {bio.length}/{BIO_MAX_LENGTH}
              </Text>
            </View>
            <TextArea
              value={bio}
              onChangeText={setBio}
              maxLength={BIO_MAX_LENGTH}
              className="h-[72px] min-h-[72px]"
            />
          </TextField>
        </SettingsSection>

        <SettingsSection title={t("settings.yourGame")} layout="form">
          <View className="gap-2">
            <SettingsFieldLabel>{t("settings.hand")}</SettingsFieldLabel>
            <SegmentedControl options={handOptions} value={hand} onChange={setHand} />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>{t("settings.preferredSide")}</SettingsFieldLabel>
            <SegmentedControl options={sideOptions} value={side} onChange={setSide} />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>{t("settings.playStyle")}</SettingsFieldLabel>
            <SegmentedControl
              options={playStyleOptions}
              value={playStyle}
              onChange={setPlayStyle}
              size="sm"
            />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>{t("settings.clubs")}</SettingsFieldLabel>
            <View className="flex-row flex-wrap gap-1.5">
              {clubs.map((club) => (
                <ClubChip
                  key={club}
                  name={club}
                  onRemove={() => setEditedClubs(clubs.filter((name) => name !== club))}
                />
              ))}
              <AddClubButton
                options={allClubs
                  .filter((club) => club.status === "published")
                  .map((club) => club.name)
                  .filter((name) => !clubs.includes(name))}
                onAdd={(name) => setEditedClubs([...clubs, name])}
              />
            </View>
          </View>
        </SettingsSection>

        <View className="flex-row items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5">
          <View className="size-11 items-center justify-center rounded-[14px] bg-fill">
            <Icon as={Lock} size={20} color="muted" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-bold text-[15px] text-foreground">
              {t("settings.level", { level: (account.level ?? myProfile.level).toFixed(1) })}
            </Text>
            <Text className="font-normal text-[13px] leading-[18px] text-muted">
              {t("settings.levelLocked")}
            </Text>
          </View>
        </View>

        <SettingsSection title={t("settings.account")}>
          <SettingsRow
            caption={t("settings.phone")}
            label={`+216 ${formatPhone(account.phone)}`}
            onPress={() => comingSoon(t("settings.changingPhone"))}
          />
          <SettingsRow
            caption={t("settings.email")}
            label={account.email ?? t("settings.noEmail")}
            onPress={() => comingSoon(t("settings.changingEmail"))}
          />
          <SettingsRow
            label={t("settings.changePassword")}
            onPress={() => comingSoon(t("settings.changingPassword"))}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.notifications")}>
          <NotificationRows />
          <SettingsRow
            label={t("settings.whoCanSee")}
            value={t("settings.visibilityFriends")}
            onPress={() => comingSoon(t("settings.matchPrivacy"))}
          />
          <LanguageRow />
        </SettingsSection>

        <View className="mt-1 gap-2.5">
          <Button size="lg" variant="ghost" onPress={() => setIsDeleteOpen(true)}>
            <Button.Label className="text-danger">{t("settings.deleteAccount")}</Button.Label>
          </Button>
          <Text className="-mt-1 text-center font-normal text-[12px] leading-[17px] text-muted">
            {t("settings.deleteNote")}
          </Text>
        </View>
      </Page.Body>

      <DeleteAccountSheet
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        losses={[
          t("settings.lossLevel", { level: (account.level ?? myProfile.level).toFixed(1) }),
          t("settings.lossMatches", {
            matches: t("profile.matchesCount", { count: myProfile.matchesPlayed }),
          }),
          t("settings.lossFriends", {
            friends: t("profile.friendsCount", { count: myProfile.friendCount }),
          }),
          t("settings.lossChats"),
        ]}
        hostedMatch={
          hostedMatch
            ? { startsAt: hostedMatch.startsAt, otherPlayerCount: hostedMatch.players.length - 1 }
            : undefined
        }
        onDelete={deleteAccount}
      />
    </Page>
  );
}

/** "20123456" as "20 123 456" */
function formatPhone(digits: string) {
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

/** Language row: opens a list and switches the whole app at once (it isn't part of Save). */
/** Push on or off for this phone, then a switch per kind of push (saved to your account). */
function NotificationRows() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: permission } = usePushPermission();
  const { data: settings } = useNotificationSettings();
  const saveSettings = useSaveNotificationSettings();

  // iOS shows its prompt only once; after that, pushes are switched on or off in Settings
  function changePermission() {
    if (permission === "undetermined") void askForPushNotifications();
    else Linking.openSettings();
  }

  function setKind(kind: keyof NonNullable<typeof settings>, on: boolean) {
    if (!settings) return;
    saveSettings.mutate(
      { ...settings, [kind]: on },
      {
        onError: (error) =>
          toast.show({ variant: "danger", label: t("settings.notificationsSaveFailed"), description: errorMessage(error) }),
      },
    );
  }

  return (
    <>
      <SettingsRow
        label={t("settings.pushNotifications")}
        value={
          permission === "granted"
            ? t("settings.pushOn")
            : permission === "denied"
              ? t("settings.pushOpenSettings")
              : t("settings.pushTurnOn")
        }
        onPress={changePermission}
      />
      {settings ? (
        <>
          <SettingsSwitchRow
            label={t("settings.notifyChat")}
            isSelected={settings.chat}
            onSelectedChange={(on) => setKind("chat", on)}
          />
          <SettingsSwitchRow
            label={t("settings.notifyMatchUpdates")}
            isSelected={settings.matchUpdates}
            onSelectedChange={(on) => setKind("matchUpdates", on)}
          />
          <SettingsSwitchRow
            label={t("settings.notifyScores")}
            isSelected={settings.scores}
            onSelectedChange={(on) => setKind("scores", on)}
          />
          <SettingsSwitchRow
            label={t("settings.notifyConnections")}
            isSelected={settings.connections}
            onSelectedChange={(on) => setKind("connections", on)}
          />
          <SettingsSwitchRow
            label={t("settings.notifyTournaments")}
            isSelected={settings.tournaments}
            onSelectedChange={(on) => setKind("tournaments", on)}
          />
        </>
      ) : null}
    </>
  );
}

function LanguageRow() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const current = i18n.language as Language;

  return (
    <Select
      value={{ value: current, label: LANGUAGE_NAMES[current] }}
      onValueChange={(option) => {
        if (option) void setLanguage(option.value as Language);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      presentation="dialog"
    >
      <SettingsRow
        label={t("settings.language")}
        value={LANGUAGE_NAMES[current]}
        onPress={() => setIsOpen(true)}
      />
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">{t("settings.language")}</Select.ListLabel>
          {LANGUAGES.map((language) => (
            <Select.Item key={language} value={language} label={LANGUAGE_NAMES[language]} />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}

/** A club you play at, as a solid pill with a remove button. */
function ClubChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="h-[34px] flex-row items-center gap-1 rounded-full bg-accent pe-1.5 ps-3">
      <Text className="font-semibold text-[13px] text-accent-foreground">{name}</Text>
      <PressableFeedback
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t("settings.removeClub", { name })}
        hitSlop={8}
        className="size-6 items-center justify-center rounded-full bg-white/20"
      >
        <Icon as={X} size={12} color="accent-foreground" />
      </PressableFeedback>
    </View>
  );
}

/** Dashed "+ Add club" pill that opens a list of the clubs you haven't added. */
function AddClubButton({ options, onAdd }: { options: string[]; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  if (options.length === 0) return null;

  return (
    <Select
      value={undefined}
      onValueChange={(option) => {
        if (option) onAdd(option.value);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      presentation="dialog"
    >
      <PressableFeedback
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("settings.addClubA11y")}
        className="h-[34px] flex-row items-center gap-1 rounded-full border border-dashed border-slot-border px-3"
      >
        <Icon as={Plus} size={14} color="accent" />
        <Text className="font-bold text-[13px] text-accent">{t("settings.addClub")}</Text>
      </PressableFeedback>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">{t("settings.addClubA11y")}</Select.ListLabel>
          {options.map((name) => (
            <Select.Item key={name} value={name} label={name} />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
