import { FieldError, Input, Label, TextArea, TextField } from "heroui-native";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { BirthdayField } from "@/components/birthday-field";
import { Dropdown } from "@/components/dropdown";
import { Page } from "@/components/page";
import { PhotoPicker } from "@/components/photo-picker";
import { cities } from "@/data/mock";
import { latestBirthday, MIN_AGE } from "@/lib/age";
import { isLocalPhone } from "@/lib/validation";

const BIO_MAX_LENGTH = 150;
const cityOptions = cities.map((city) => ({ value: city, label: city }));

export type Gender = "male" | "female";

export type AboutValues = {
  photoUri?: string;
  firstName: string;
  lastName: string;
  gender: Gender | undefined;
  birthday: Date | undefined;
  /** The 8 digits after +216 */
  phone: string;
  city: string;
  bio: string;
};

export const initialAboutValues: AboutValues = {
  firstName: "",
  lastName: "",
  gender: undefined,
  birthday: undefined,
  phone: "",
  city: cities[0],
  bio: "",
};

function genderOptions(t: TFunction) {
  return [
    { value: "male" as const, label: t("setup.male") },
    { value: "female" as const, label: t("setup.female") },
  ];
}

export function isAboutComplete(values: AboutValues) {
  return (
    values.firstName.trim() !== "" &&
    values.lastName.trim() !== "" &&
    values.gender !== undefined &&
    values.birthday !== undefined &&
    values.birthday <= latestBirthday() &&
    isLocalPhone(values.phone)
  );
}

type SetupAboutStepProps = {
  values: AboutValues;
  onChange: (values: AboutValues) => void;
  /** Show errors once the player has tried to continue */
  showErrors: boolean;
};

/** Profile setup step 1, "Tell us about you": photo, name, gender, birthday, phone, city and bio. */
export function SetupAboutStep({ values, onChange, showErrors }: SetupAboutStepProps) {
  const { t } = useTranslation();

  function set<K extends keyof AboutValues>(key: K, value: AboutValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <>
      <Page.Title description={t("setup.aboutText")}>{t("setup.aboutTitle")}</Page.Title>

      <PhotoPicker uri={values.photoUri} onChange={(uri) => set("photoUri", uri)} />

      <View className="flex-row gap-3">
        <TextField isInvalid={showErrors && values.firstName.trim() === ""} className="flex-1">
          <Label>{t("settings.firstName")}</Label>
          <Input
            value={values.firstName}
            onChangeText={(text) => set("firstName", text)}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
          />
          <FieldError>{t("settings.firstNameError")}</FieldError>
        </TextField>
        <TextField isInvalid={showErrors && values.lastName.trim() === ""} className="flex-1">
          <Label>{t("settings.lastName")}</Label>
          <Input
            value={values.lastName}
            onChangeText={(text) => set("lastName", text)}
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="next"
          />
          <FieldError>{t("settings.lastNameError")}</FieldError>
        </TextField>
      </View>

      <View className="gap-1.5">
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5">
            <Text className="font-semibold text-[14px] text-foreground">{t("setup.gender")}</Text>
            <Dropdown
              label={t("setup.gender")}
              placeholder={t("setup.genderPlaceholder")}
              options={genderOptions(t)}
              value={genderOptions(t).find((option) => option.value === values.gender)}
              onChange={(option) => option && set("gender", option.value as Gender)}
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="font-semibold text-[14px] text-foreground">{t("setup.birthday")}</Text>
            <BirthdayField
              value={values.birthday}
              onChange={(birthday) => set("birthday", birthday)}
              placeholder={t("setup.birthdayPlaceholder")}
              accessibilityLabel={t("setup.birthday")}
              isInvalid={showErrors && !values.birthday}
            />
          </View>
        </View>
        {showErrors && values.gender === undefined ? (
          <Text className="text-[13px] text-danger">{t("setup.genderError")}</Text>
        ) : null}
        {showErrors && !values.birthday ? (
          <Text className="text-[13px] text-danger">{t("setup.birthdayError", { age: MIN_AGE })}</Text>
        ) : null}
      </View>

      <TextField isInvalid={showErrors && !isLocalPhone(values.phone)}>
        <Label>{t("setup.phoneNumber")}</Label>
        {/* design.md "Phone input": fixed +216 box, then the number */}
        <View className="flex-row gap-2">
          <View className="h-[52px] justify-center rounded-[14px] border border-line-input bg-surface px-3.5">
            <Text className="font-bold text-[16px] text-foreground">+216</Text>
          </View>
          <Input
            value={values.phone}
            onChangeText={(text) => set("phone", text)}
            placeholder="20 123 456"
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            accessibilityLabel={t("setup.phoneA11y")}
            className="flex-1"
          />
        </View>
        <FieldError>{t("setup.phoneError")}</FieldError>
      </TextField>

      <View className="gap-1.5">
        <Text className="font-semibold text-[14px] text-foreground">{t("settings.city")}</Text>
        <Dropdown
          label={t("settings.city")}
          placeholder={t("settings.chooseCity")}
          options={cityOptions}
          value={cityOptions.find((option) => option.value === values.city)}
          onChange={(option) => option && set("city", option.value)}
        />
      </View>

      <TextField>
        <View className="flex-row items-baseline gap-1">
          {/* Label only takes plain text, so "(optional)" sits next to it */}
          <Label>{t("setup.shortBio")}</Label>
          <Text className="flex-1 font-medium text-[14px] text-muted">{t("photoPicker.optional")}</Text>
          <Text className="font-normal text-[13px] text-muted">
            {values.bio.length}/{BIO_MAX_LENGTH}
          </Text>
        </View>
        <TextArea
          value={values.bio}
          onChangeText={(text) => set("bio", text)}
          maxLength={BIO_MAX_LENGTH}
          placeholder={t("setup.bioPlaceholder")}
          className="h-[72px] min-h-[72px]"
        />
      </TextField>
    </>
  );
}
