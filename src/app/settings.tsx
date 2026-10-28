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
import { Lock, LogOut, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

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
import { allClubs, cities, me, myAccount, myClubNames, myProfile, upcomingMatches } from "@/data/mock";
import { myProfileKey, useMyAccount } from "@/hooks/useMyProfile";
import { queryClient } from "@/lib/query-client";
import { deleteOwnAccount, signOut } from "@/repositories/auth-repository";
import { updateProfile } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";

const BIO_MAX_LENGTH = 150;
const cityOptions = cities.map((city) => ({ value: city, label: city }));

const handOptions: { value: Hand; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
];
const sideOptions: { value: Side; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];
const playStyleOptions: { value: PlayStyle; label: string }[] = [
  { value: "aggressive", label: "Aggressive" },
  { value: "balanced", label: "Balanced" },
  { value: "defensive", label: "Defensive" },
  { value: "tactical", label: "Tactical" },
];

// A match you host would be cancelled if you delete your account
const hostedMatch = upcomingMatches.find((match) => match.host.id === me.id);

/** Edit profile and settings, opened from the Profile hero's top-right button. */
export default function Settings() {
  const { data: account, error, refetch, isRefetching } = useMyAccount();

  if (!account) {
    return (
      <Page underStatusBar>
        <Page.Header bar back leading={<Text className="font-black text-[20px] text-foreground">Edit profile</Text>} />
        <Page.Body scroll={false} className="items-center justify-center gap-3">
          {error ? (
            <>
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                Couldn’t load your profile
              </Text>
              <Text className="text-center font-normal text-[14px] text-muted">{error.message}</Text>
              <Button variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
                Try again
              </Button>
            </>
          ) : (
            <Spinner accessibilityLabel="Loading your profile" />
          )}
        </Page.Body>
      </Page>
    );
  }

  return <SettingsForm account={account} />;
}

/** The form itself; it starts from the saved profile, so it only mounts once that has loaded. */
function SettingsForm({ account }: { account: MyAccount }) {
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
  const [clubs, setClubs] = useState(myClubNames);
  const [notifications, setNotifications] = useState(myAccount.notifications);
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
    Alert.alert("Discard your changes?", "What you edited won’t be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
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
      toast.show({ variant: "success", label: "Profile saved" });
      setLeaving("back");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn’t save your profile",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // The account rows open their own screens once those exist
  function comingSoon(label: string) {
    toast.show({ label, description: "This is coming soon." });
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

  async function logOut() {
    // Signing out clears the session on the device even if the network call fails
    try {
      await signOut();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn’t log you out",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return;
    }
    leaveToSignIn();
  }

  async function deleteAccount() {
    try {
      await deleteOwnAccount();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn’t delete your account",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return;
    }
    setIsDeleteOpen(false);
    toast.show({ label: "Your account was deleted", description: "We're sorry to see you go." });
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
            Edit profile
          </Text>
        }
      >
        <Button size="sm" onPress={save} isDisabled={isSaving} className="h-10 rounded-xl px-4">
          Save
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

        <SettingsSection title="About you" layout="form">
          <View className="flex-row gap-2.5">
            <TextField isInvalid={firstNameError} className="flex-1">
              <Label>First name</Label>
              <Input
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                textContentType="givenName"
              />
              <FieldError>Add your first name.</FieldError>
            </TextField>
            <TextField isInvalid={lastNameError} className="flex-1">
              <Label>Last name</Label>
              <Input
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                textContentType="familyName"
              />
              <FieldError>Add your last name.</FieldError>
            </TextField>
          </View>

          <View className="gap-1.5">
            <Text className="font-semibold text-[14px] text-foreground">City</Text>
            <Dropdown
              label="City"
              placeholder="Choose your city"
              options={cityOptions}
              value={cityOptions.find((option) => option.value === city)}
              onChange={(option) => option && setCity(option.value)}
            />
          </View>

          <TextField>
            <View className="flex-row items-baseline justify-between">
              <Label>Bio</Label>
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

        <SettingsSection title="Your game" layout="form">
          <View className="gap-2">
            <SettingsFieldLabel>Playing hand</SettingsFieldLabel>
            <SegmentedControl options={handOptions} value={hand} onChange={setHand} />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>Preferred side</SettingsFieldLabel>
            <SegmentedControl options={sideOptions} value={side} onChange={setSide} />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>Play style</SettingsFieldLabel>
            <SegmentedControl
              options={playStyleOptions}
              value={playStyle}
              onChange={setPlayStyle}
              size="sm"
            />
          </View>
          <View className="gap-2">
            <SettingsFieldLabel>Clubs</SettingsFieldLabel>
            <View className="flex-row flex-wrap gap-1.5">
              {clubs.map((club) => (
                <ClubChip
                  key={club}
                  name={club}
                  onRemove={() => setClubs((current) => current.filter((name) => name !== club))}
                />
              ))}
              <AddClubButton
                options={allClubs.map((club) => club.name).filter((name) => !clubs.includes(name))}
                onAdd={(name) => setClubs((current) => [...current, name])}
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
              Level {(account.level ?? myProfile.level).toFixed(1)}
            </Text>
            <Text className="font-normal text-[13px] leading-[18px] text-muted">
              Can’t be edited. It moves with your match scores and player reviews.
            </Text>
          </View>
        </View>

        <SettingsSection title="Account">
          <SettingsRow
            caption="Phone"
            label={`+216 ${formatPhone(account.phone)}`}
            onPress={() => comingSoon("Changing your phone")}
          />
          <SettingsRow
            caption="Email"
            label={account.email ?? "No email"}
            onPress={() => comingSoon("Changing your email")}
          />
          <SettingsRow label="Change password" onPress={() => comingSoon("Changing your password")} />
        </SettingsSection>

        <SettingsSection title="Notifications & privacy">
          <SettingsSwitchRow
            label="New matches at my level"
            isSelected={notifications.newMatches}
            onSelectedChange={(on) => setNotifications((current) => ({ ...current, newMatches: on }))}
          />
          <SettingsSwitchRow
            label="Invites & connection requests"
            isSelected={notifications.invites}
            onSelectedChange={(on) => setNotifications((current) => ({ ...current, invites: on }))}
          />
          <SettingsSwitchRow
            label="Match chat messages"
            isSelected={notifications.chat}
            onSelectedChange={(on) => setNotifications((current) => ({ ...current, chat: on }))}
          />
          <SettingsRow
            label="Who can see my matches"
            value={myAccount.matchVisibility}
            onPress={() => comingSoon("Match privacy")}
          />
          <SettingsRow
            label="Language"
            value={myAccount.language}
            onPress={() => comingSoon("French and Arabic")}
          />
        </SettingsSection>

        <View className="mt-1 gap-2.5">
          <Button size="lg" variant="outline" onPress={logOut}>
            <Icon as={LogOut} size={20} color="foreground" />
            <Button.Label className="text-foreground">Log out</Button.Label>
          </Button>
          <Button size="lg" variant="ghost" onPress={() => setIsDeleteOpen(true)}>
            <Button.Label className="text-danger">Delete account</Button.Label>
          </Button>
          <Text className="-mt-1 text-center font-normal text-[12px] leading-[17px] text-muted">
            Deleting removes your profile, matches and reviews for good.
          </Text>
        </View>
      </Page.Body>

      <DeleteAccountSheet
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        losses={[
          `Your level ${(account.level ?? myProfile.level).toFixed(1)} and its history`,
          `${myProfile.matchesPlayed} matches, stats and feed posts`,
          `${myProfile.reviewCount} reviews and ${myProfile.friendCount} friends`,
          "Your match chats",
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

/** A club you play at, as a solid pill with a remove button. */
function ClubChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <View className="h-[34px] flex-row items-center gap-1 rounded-full bg-accent pe-1.5 ps-3">
      <Text className="font-semibold text-[13px] text-accent-foreground">{name}</Text>
      <PressableFeedback
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
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
        accessibilityLabel="Add a club"
        className="h-[34px] flex-row items-center gap-1 rounded-full border border-dashed border-slot-border px-3"
      >
        <Icon as={Plus} size={14} color="accent" />
        <Text className="font-bold text-[13px] text-accent">Add club</Text>
      </PressableFeedback>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">Add a club</Select.ListLabel>
          {options.map((name) => (
            <Select.Item key={name} value={name} label={name} />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
