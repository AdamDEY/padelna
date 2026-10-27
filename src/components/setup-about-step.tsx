import { FieldError, Input, Label, TextArea, TextField } from "heroui-native";
import { Text, View } from "react-native";

import { Dropdown } from "@/components/dropdown";
import { Page } from "@/components/page";
import { PhotoPicker } from "@/components/photo-picker";
import { cities } from "@/data/mock";
import { isLocalPhone } from "@/lib/validation";

const BIO_MAX_LENGTH = 150;
const cityOptions = cities.map((city) => ({ value: city, label: city }));

export type AboutValues = {
  photoUri?: string;
  firstName: string;
  lastName: string;
  /** The 8 digits after +216 */
  phone: string;
  city: string;
  bio: string;
};

export const initialAboutValues: AboutValues = {
  firstName: "",
  lastName: "",
  phone: "",
  city: cities[0],
  bio: "",
};

export function isAboutComplete(values: AboutValues) {
  return values.firstName.trim() !== "" && values.lastName.trim() !== "" && isLocalPhone(values.phone);
}

type SetupAboutStepProps = {
  values: AboutValues;
  onChange: (values: AboutValues) => void;
  /** Show errors once the player has tried to continue */
  showErrors: boolean;
};

/** Profile setup step 1, "Tell us about you": photo, name, phone, city and bio. */
export function SetupAboutStep({ values, onChange, showErrors }: SetupAboutStepProps) {
  function set<K extends keyof AboutValues>(key: K, value: AboutValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <>
      <Page.Title description="This is how other players will see you.">Tell us about you</Page.Title>

      <PhotoPicker uri={values.photoUri} onChange={(uri) => set("photoUri", uri)} />

      <View className="flex-row gap-3">
        <TextField isInvalid={showErrors && values.firstName.trim() === ""} className="flex-1">
          <Label>First name</Label>
          <Input
            value={values.firstName}
            onChangeText={(text) => set("firstName", text)}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
          />
          <FieldError>Add your first name.</FieldError>
        </TextField>
        <TextField isInvalid={showErrors && values.lastName.trim() === ""} className="flex-1">
          <Label>Last name</Label>
          <Input
            value={values.lastName}
            onChangeText={(text) => set("lastName", text)}
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="next"
          />
          <FieldError>Add your last name.</FieldError>
        </TextField>
      </View>

      <TextField isInvalid={showErrors && !isLocalPhone(values.phone)}>
        <Label>Phone number</Label>
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
            accessibilityLabel="Phone number, after +216"
            className="flex-1"
          />
        </View>
        <FieldError>Enter the 8 digits of your number.</FieldError>
      </TextField>

      <View className="gap-1.5">
        <Text className="font-semibold text-[14px] text-foreground">City</Text>
        <Dropdown
          label="City"
          placeholder="Choose your city"
          options={cityOptions}
          value={cityOptions.find((option) => option.value === values.city)}
          onChange={(option) => option && set("city", option.value)}
        />
      </View>

      <TextField>
        <View className="flex-row items-baseline gap-1">
          {/* Label only takes plain text, so "(optional)" sits next to it */}
          <Label>Short bio</Label>
          <Text className="flex-1 font-medium text-[14px] text-muted">(optional)</Text>
          <Text className="font-normal text-[13px] text-muted">
            {values.bio.length}/{BIO_MAX_LENGTH}
          </Text>
        </View>
        <TextArea
          value={values.bio}
          onChangeText={(text) => set("bio", text)}
          maxLength={BIO_MAX_LENGTH}
          placeholder="Weekend player, love long rallies."
          className="h-[72px] min-h-[72px]"
        />
      </TextField>
    </>
  );
}
