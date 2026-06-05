import { zodResolver } from "@hookform/resolvers/zod";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  fetchLabourById,
  formatAadhaarGrouped,
  formatAadhaarMasked,
  MEMBER_RELATION_OPTIONS,
  submitLabourRegistration,
} from "../api/labourService.js";
import yoloLogoUrl from "../assets/logo.png";
import {
  completedYearsFromDobIso,
  createLabourRegistrationSchema,
  getDefaultFormValues,
  getManualDefaultFormValues,
  MOBILE_DIGITS,
  ADDRESS_MAX,
} from "../validation/labourRegistrationSchema.js";
import { showToast } from "../utils/toast.js";
import PreviewModal from "./PreviewModal.jsx";

const BarcodeScanModal = lazy(() => import("./BarcodeScanModal.jsx"));
const LabourLivePhotoModal = lazy(() => import("./LabourLivePhotoModal.jsx"));

const ENTRY_LOOKUP = "lookup";
const ENTRY_MANUAL = "manual";

function FieldError({ message, id }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

function parseFamilyCardLabel(label) {
  const s = String(label || "").trim();
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), relation: m[2].trim() };
  return { name: s || "Member", relation: "Family" };
}

function genderAbbrev(formGender) {
  const g = String(formGender || "").trim().toLowerCase();
  if (g === "male" || g === "m") return "M";
  if (g === "female" || g === "f") return "F";
  if (g === "other") return "O";
  if (g === "prefer_not") return "—";
  if (g) return g.charAt(0).toUpperCase();
  return "—";
}

function resolveCardAgeYears(snapshot, apiYears) {
  const fromDob = completedYearsFromDobIso(snapshot.dob);
  if (fromDob !== null) return fromDob;
  if (apiYears !== null && apiYears !== undefined && Number.isFinite(apiYears)) return apiYears;
  return null;
}

function formatGenderAgeLine(snapshot, apiYears) {
  const g = genderAbbrev(snapshot.gender);
  const age = resolveCardAgeYears(snapshot, apiYears);
  const agePart = age !== null ? `${age}Y` : "—";
  return `${g} | ${agePart}`;
}

function formatAadhaarForCard(snapshot) {
  return formatAadhaarGrouped(snapshot.aadhaar) || "—";
}

function findFirstSelectableMember(main, _mainApiAge, _familyList) {
  return { key: "main", formSlice: main };
}

function scrollToField(fieldKey, labourIdInputId) {
  const el = document.getElementById(
    fieldKey === "geoTaggedPhoto"
      ? "geo-photo-section"
      : fieldKey === "member-cards-anchor"
        ? "member-cards-anchor"
        : fieldKey === "labourId"
          ? labourIdInputId
          : fieldKey === "countryCode"
            ? "countryCode"
            : fieldKey,
  );
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

export default function LabourRegistrationForm({ atmId = "" }) {
  const [entryMode, setEntryMode] = useState(ENTRY_LOOKUP);
  const [geoPhoto, setGeoPhoto] = useState(null);
  const geoPreviewRevokeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingLabour, setLoadingLabour] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState(null);
  const wasPreviewOpenRef = useRef(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false);
  const [livePhotoModalOpen, setLivePhotoModalOpen] = useState(false);
  const [mainMemberForm, setMainMemberForm] = useState(null);
  const [mainCardAgeYears, setMainCardAgeYears] = useState(null);
  const [familyOptions, setFamilyOptions] = useState([]);
  const [selectedMemberKey, setSelectedMemberKey] = useState("main");
  const [aadhaarVisible, setAadhaarVisible] = useState(false);
  const [aadhaarFocused, setAadhaarFocused] = useState(false);

  const isManualEntry = entryMode === ENTRY_MANUAL;
  const labourIdInputId = isManualEntry ? "manual-labourId" : "labourId";

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    trigger,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: getDefaultFormValues(),
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: (values, context, options) =>
      zodResolver(createLabourRegistrationSchema({ requireRelation: isManualEntry }))(
        values,
        context,
        options,
      ),
  });

  const aadhaarValue = watch("aadhaar");

  const setGeoPhotoSafe = useCallback((next) => {
    if (geoPreviewRevokeRef.current) {
      URL.revokeObjectURL(geoPreviewRevokeRef.current);
      geoPreviewRevokeRef.current = null;
    }
    if (next?.previewUrl) geoPreviewRevokeRef.current = next.previewUrl;
    setGeoPhoto(next);
  }, []);

  useEffect(() => {
    if (wasPreviewOpenRef.current && !previewOpen) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasPreviewOpenRef.current = previewOpen;
  }, [previewOpen]);

  useEffect(() => {
    return () => {
      if (geoPreviewRevokeRef.current) {
        URL.revokeObjectURL(geoPreviewRevokeRef.current);
        geoPreviewRevokeRef.current = null;
      }
    };
  }, []);

  function resetRegistrationDraft() {
    reset(getDefaultFormValues());
    clearErrors();
    setLoadError("");
    setLoaded(false);
    setMainMemberForm(null);
    setMainCardAgeYears(null);
    setFamilyOptions([]);
    setSelectedMemberKey("main");
    setGeoPhotoSafe(null);
    setPreviewOpen(false);
    setPreviewValues(null);
    setAadhaarVisible(false);
    setAadhaarFocused(false);
  }

  function switchEntryMode(mode) {
    if (mode === entryMode) return;
    resetRegistrationDraft();
    showToast.dismissAll();
    setEntryMode(mode);
    if (mode === ENTRY_MANUAL) {
      reset(getManualDefaultFormValues());
    }
  }

  function onAadhaarKeyDown(e, currentValue, onChange) {
    if (aadhaarVisible) return;

    const digits = String(currentValue || "").replace(/\D/g, "");

    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      if (digits.length < 12) {
        onChange(digits + e.key);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      onChange(digits.slice(0, -1));
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      onChange("");
    }
  }

  function onAadhaarPaste(e, onChange) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 12);
    if (pasted) onChange(pasted);
  }

  function selectMemberByKey(key) {
    if (!mainMemberForm) return;
    const regId = mainMemberForm.labourId;
    clearErrors();
    setGeoPhotoSafe(null);
    if (key === "main") {
      setSelectedMemberKey(key);
      reset({ ...getDefaultFormValues(), ...mainMemberForm, labourId: regId });
      return;
    }
    const prefix = "family:";
    if (key.startsWith(prefix)) {
      const fid = key.slice(prefix.length);
      const opt = familyOptions.find((o) => o.familyRecordId === fid);
      if (!opt) return;
      setSelectedMemberKey(key);
      reset({ ...getDefaultFormValues(), ...opt.form, labourId: regId });
    }
  }

  async function onLoadLabour() {
    setLoadError("");
    showToast.dismissAll();
    const idValid = await trigger("labourId");
    if (!idValid) return;

    const id = String(getValues("labourId") || "").trim();
    setLoadingLabour(true);
    try {
      const { main, mainCardAgeYears: mainAge, familyOptions: familyList } = await fetchLabourById(
        id,
        { atmId },
      );
      setMainMemberForm(main);
      setMainCardAgeYears(mainAge ?? null);
      setFamilyOptions(familyList);
      const pick = findFirstSelectableMember(main, mainAge ?? null, familyList);
      if (pick) {
        setSelectedMemberKey(pick.key);
        reset({
          ...getDefaultFormValues(),
          ...pick.formSlice,
          labourId: main.labourId || id,
        });
      } else {
        setSelectedMemberKey("");
        reset({ ...getDefaultFormValues(), labourId: main.labourId || id });
      }
      clearErrors();
      setGeoPhotoSafe(null);
      setLoaded(true);
    } catch (e) {
      setLoaded(false);
      setMainMemberForm(null);
      setMainCardAgeYears(null);
      setFamilyOptions([]);
      setSelectedMemberKey("");
      setGeoPhotoSafe(null);
      setLoadError(e.message || "Something went wrong.");
    } finally {
      setLoadingLabour(false);
    }
  }

  function notifySubmitIssue(message, fieldKey) {
    showToast.error(message);
    if (fieldKey) scrollToField(fieldKey, labourIdInputId);
  }

  function openPreview(values) {
    if (!geoPhoto?.blob) {
      setError("geoTaggedPhoto", {
        type: "manual",
        message: "Take a Labour live photo before continuing.",
      });
      notifySubmitIssue("Take a Labour live photo before continuing.", "geoTaggedPhoto");
      return;
    }

    setPreviewValues({
      ...values,
      atmId,
      geoTaggedPhoto: geoPhoto.blob,
      geoPhotoMeta: geoPhoto.meta,
      geoTaggedPreviewUrl: geoPhoto.previewUrl,
    });
    setPreviewOpen(true);
  }

  const onValidSubmit = (values) => {
    if (isManualEntry) {
      openPreview(values);
      return;
    }
    if (!loaded || !mainMemberForm) return;
    if (!selectedMemberKey) {
      notifySubmitIssue("Select a household member to register.", "member-cards-anchor");
      document.getElementById("member-cards-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    openPreview(values);
  };

  const onInvalidSubmit = (fieldErrors) => {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstMessage =
      firstKey && fieldErrors[firstKey]?.message
        ? String(fieldErrors[firstKey].message)
        : "Please complete all required fields marked with *.";
    notifySubmitIssue(firstMessage, firstKey);
  };

  async function onConfirmRegister() {
    if (!previewValues) return;
    setFinalSubmitting(true);
    showToast.dismissAll();
    try {
      await submitLabourRegistration({
        atmId: previewValues.atmId,
        labourId: previewValues.labourId,
        name: previewValues.name,
        countryCode: previewValues.countryCode,
        mobile: previewValues.mobile,
        aadhaar: previewValues.aadhaar,
        email: previewValues.email,
        dob: previewValues.dob,
        gender: previewValues.gender,
        mappedBarcode: previewValues.mappedBarcode,
        memberRelation: previewValues.memberRelation,
        address: String(previewValues.address || "").trim(),
        geoTaggedPhoto: previewValues.geoTaggedPhoto,
        geoPhotoMeta: previewValues.geoPhotoMeta,
      });
      setPreviewOpen(false);
      setPreviewValues(null);
      showToast.success("Registration submitted successfully.");
      if (entryMode === ENTRY_LOOKUP) {
        reset(getDefaultFormValues());
        clearErrors();
        setLoaded(false);
        setGeoPhotoSafe(null);
        setMainMemberForm(null);
        setMainCardAgeYears(null);
        setFamilyOptions([]);
        setSelectedMemberKey("main");
      } else {
        resetRegistrationDraft();
        reset(getManualDefaultFormValues());
      }
    } catch (e) {
      setPreviewOpen(false);
      setPreviewValues(null);
      showToast.error(e.message || "Submission failed.");
    } finally {
      setFinalSubmitting(false);
    }
  }

  const memberCards = useMemo(() => {
    if (!mainMemberForm) return [];
    const mainAge = resolveCardAgeYears(mainMemberForm, mainCardAgeYears);
    const list = [
      {
        key: "main",
        name: String(mainMemberForm.name || "").trim() || "—",
        role: "Main Member",
        genderAgeLine: formatGenderAgeLine(mainMemberForm, mainCardAgeYears),
        aadhaarLine: formatAadhaarForCard(mainMemberForm),
        ageYears: mainAge,
        selectable: true,
      },
    ];
    for (const o of familyOptions) {
      const { name, relation } = parseFamilyCardLabel(o.label);
      const age = resolveCardAgeYears(o.form, o.cardAgeYears ?? null);
      list.push({
        key: `family:${o.familyRecordId}`,
        name,
        role: relation,
        genderAgeLine: formatGenderAgeLine(o.form, o.cardAgeYears ?? null),
        aadhaarLine: formatAadhaarForCard(o.form),
        ageYears: age,
        selectable: true,
      });
    }
    return list;
  }, [mainMemberForm, mainCardAgeYears, familyOptions]);

  const aadhaarDisplayValue = aadhaarVisible
    ? formatAadhaarGrouped(aadhaarValue)
    : formatAadhaarMasked(aadhaarValue, { revealLastDigit: aadhaarFocused });

  const labourDetailsGrid = (
    <div className="labour-form">
      <div className="form-grid form-grid--labour">
        {isManualEntry ? (
          <div className="field field--full field--labour-id">
            <label className="field-label" htmlFor="manual-labourId">
              Labour ID <span className="req">*</span>
            </label>
            <input
              id="manual-labourId"
              type="text"
              className="input"
              autoComplete="off"
              placeholder="Enter labour ID"
              disabled={finalSubmitting}
              aria-invalid={errors.labourId ? "true" : "false"}
              {...register("labourId")}
            />
            <FieldError message={errors.labourId?.message} />
          </div>
        ) : null}

        {isManualEntry ? (
          <div className="field field--relation">
            <label className="field-label" htmlFor="memberRelation">
              Relation <span className="req">*</span>
            </label>
            <select
              id="memberRelation"
              className="input input--select"
              aria-invalid={errors.memberRelation ? "true" : "false"}
              {...register("memberRelation")}
            >
              {MEMBER_RELATION_OPTIONS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
            <FieldError message={errors.memberRelation?.message} />
          </div>
        ) : null}

        <div className="field field--name">
          <label className="field-label" htmlFor="name">
            Name <span className="req">*</span>
          </label>
          <input
            id="name"
            type="text"
            className="input"
            autoComplete="name"
            placeholder="Enter full name"
            aria-invalid={errors.name ? "true" : "false"}
            {...register("name", {
              onChange: (e) => {
                const cleaned = e.target.value.replace(/\d/g, "");
                setValue("name", cleaned, { shouldValidate: true, shouldDirty: true });
              },
            })}
          />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="field field--mobile">
          <span className="field-label" id="mobile-label">
            Mobile
          </span>
          <div className="mobile-row" role="group" aria-labelledby="mobile-label">
            <input
              id="countryCode"
              type="text"
              inputMode="numeric"
              className="input input--code"
              aria-label="Country code"
              aria-invalid={errors.countryCode ? "true" : "false"}
              {...register("countryCode")}
            />
            <input
              id="mobile"
              type="tel"
              className="input input--grow"
              autoComplete="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              maxLength={MOBILE_DIGITS}
              aria-invalid={errors.mobile ? "true" : "false"}
              {...register("mobile", {
                onChange: (e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, MOBILE_DIGITS);
                  setValue("mobile", digits, { shouldValidate: true, shouldDirty: true });
                },
              })}
            />
          </div>
          <FieldError message={errors.countryCode?.message} />
          <FieldError message={errors.mobile?.message} />
        </div>

        <div className="field field--aadhaar">
          <label className="field-label" htmlFor="aadhaar">
            Aadhaar number <span className="req">*</span>
          </label>
          <Controller
            name="aadhaar"
            control={control}
            render={({ field, fieldState }) => (
              <>
                <div className="input-with-toggle">
                  <input
                    id="aadhaar"
                    type="text"
                    inputMode="numeric"
                    className="input input--with-toggle"
                    autoComplete="off"
                    maxLength={14}
                    placeholder="XXXX-XXXX-XXXX"
                    value={aadhaarDisplayValue}
                    onFocus={() => setAadhaarFocused(true)}
                    onBlur={() => {
                      setAadhaarFocused(false);
                      field.onBlur();
                    }}
                    onKeyDown={(e) => onAadhaarKeyDown(e, field.value, field.onChange)}
                    onPaste={(e) => onAadhaarPaste(e, field.onChange)}
                    onChange={(e) => {
                      if (aadhaarVisible) {
                        field.onChange(e.target.value.replace(/\D/g, "").slice(0, 12));
                      }
                    }}
                    aria-invalid={fieldState.invalid ? "true" : "false"}
                  />
                  <button
                    type="button"
                    className="input-toggle-btn"
                    onClick={() => setAadhaarVisible((v) => !v)}
                    aria-label={aadhaarVisible ? "Hide Aadhaar number" : "Show Aadhaar number"}
                    aria-pressed={aadhaarVisible}
                    title={aadhaarVisible ? "Hide Aadhaar" : "Show Aadhaar"}
                  >
                    {aadhaarVisible ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                        <path
                          d="m4 4 16 16"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                      </svg>
                    )}
                  </button>
                </div>
                <FieldError message={fieldState.error?.message} />
              </>
            )}
          />
        </div>

        <div className="field field--dob">
          <label className="field-label" htmlFor="dob">
            Date of birth <span className="req">*</span>
          </label>
          <input
            id="dob"
            type="date"
            className="input"
            aria-invalid={errors.dob ? "true" : "false"}
            aria-describedby={errors.dob ? "dob-err" : undefined}
            {...register("dob")}
          />
          <FieldError id="dob-err" message={errors.dob?.message} />
        </div>

        <div className="field field--gender">
          <label className="field-label" htmlFor="gender">
            Gender <span className="req">*</span>
          </label>
          <select
            id="gender"
            className="input input--select"
            aria-invalid={errors.gender ? "true" : "false"}
            {...register("gender")}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
          <FieldError message={errors.gender?.message} />
        </div>

        <div className="field field--email">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={errors.email ? "true" : "false"}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        <div className="field field--address">
          <label className="field-label" htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            className="input input--textarea"
            rows={2}
            autoComplete="street-address"
            placeholder="House no., street, city, PIN"
            maxLength={ADDRESS_MAX}
            aria-invalid={errors.address ? "true" : "false"}
            {...register("address")}
          />
          <FieldError message={errors.address?.message} />
        </div>

        <div
          className="field field--full geo-photo-field"
          id="geo-photo-section"
          aria-labelledby="geo-photo-label"
        >
          <span className="field-label" id="geo-photo-label">
            Labour live photo <span className="req">*</span>
          </span>
          {geoPhoto ? (
            <div className="labour-live-photo-block">
              <div className="labour-live-photo-block__thumb-wrap">
                <img
                  src={geoPhoto.previewUrl}
                  alt="Labour live photo preview"
                  className="labour-live-photo-block__thumb"
                />
              </div>
              {geoPhoto.meta?.address ? (
                <p className="field-hint labour-live-photo-block__loc">
                  <span className="labour-live-photo-block__loc-label">Location</span>
                  <span className="labour-live-photo-block__addr">{geoPhoto.meta.address}</span>
                </p>
              ) : null}
              <div className="barcode-actions labour-live-photo-block__actions">
                <button
                  type="button"
                  className="btn btn-scan"
                  onClick={() => setLivePhotoModalOpen(true)}
                  disabled={loadingLabour || finalSubmitting}
                >
                  Retake live photo
                </button>
                <a
                  href={geoPhoto.previewUrl}
                  download="labour-geo-tagged.jpg"
                  className="labour-live-photo-block__download-link"
                  onClick={(e) => {
                    if (loadingLabour || finalSubmitting) e.preventDefault();
                  }}
                  aria-disabled={loadingLabour || finalSubmitting ? "true" : undefined}
                >
                  Download
                </a>
              </div>
            </div>
          ) : (
            <>
              <p className="field-hint">
                Full-screen camera. With GPS, the saved photo includes location and time; without GPS
                you can still save a plain camera photo.
              </p>
              <div className="barcode-actions">
                <button
                  type="button"
                  className="btn btn-scan"
                  onClick={() => setLivePhotoModalOpen(true)}
                  disabled={loadingLabour || finalSubmitting}
                >
                  Take live photo
                </button>
              </div>
            </>
          )}
          <FieldError message={errors.geoTaggedPhoto?.message} />
        </div>

        <div className="field span-barcode">
          <label className="field-label" htmlFor="mappedBarcode">
            Barcode <span className="req">*</span>
          </label>
          <input
            id="mappedBarcode"
            type="text"
            className="input"
            autoComplete="off"
            maxLength={64}
            enterKeyHint="done"
            placeholder="Enter or scan barcode"
            aria-invalid={errors.mappedBarcode ? "true" : "false"}
            aria-required="true"
            {...register("mappedBarcode", {
              onChange: (e) => {
                const cleaned = e.target.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 64);
                setValue("mappedBarcode", cleaned, { shouldValidate: true, shouldDirty: true });
              },
            })}
          />
          <FieldError message={errors.mappedBarcode?.message} />
          <div className="barcode-actions">
            <button type="button" className="btn btn-scan" onClick={() => setBarcodeScanOpen(true)}>
              Scan with camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <form
        id="yh-labour-form"
        className="form-card"
        noValidate
        onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}
      >
        <h1 className="form-card__title">Labour registration</h1>

        <div className="reg-mode-tabs" role="tablist" aria-label="Registration method">
          <button
            type="button"
            role="tab"
            id="reg-tab-lookup"
            aria-selected={!isManualEntry}
            aria-controls="reg-panel-lookup"
            className={`reg-mode-tabs__tab${!isManualEntry ? " reg-mode-tabs__tab--active" : ""}`}
            onClick={() => switchEntryMode(ENTRY_LOOKUP)}
          >
            Lookup by Labour ID
          </button>
          <button
            type="button"
            role="tab"
            id="reg-tab-manual"
            aria-selected={isManualEntry}
            aria-controls="reg-panel-manual"
            className={`reg-mode-tabs__tab${isManualEntry ? " reg-mode-tabs__tab--active" : ""}`}
            onClick={() => switchEntryMode(ENTRY_MANUAL)}
          >
            Manual registration
          </button>
        </div>

        {!isManualEntry ? (
          <section className="labour-id-block" aria-label="Labour lookup">
            <label className="field-label" htmlFor="labourId">
              Labour ID <span className="req">*</span>
            </label>
            <div className="labour-id-row">
              <input
                id="labourId"
                type="search"
                className="input"
                autoComplete="off"
                placeholder="Enter labour ID"
                disabled={loadingLabour}
                aria-invalid={errors.labourId ? "true" : "false"}
                aria-describedby={loadError ? "load-err" : undefined}
                {...register("labourId")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onLoadLabour();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-load-details"
                onClick={onLoadLabour}
                disabled={loadingLabour}
              >
                {loadingLabour ? <span className="inline-spinner" aria-hidden /> : null}
                {loadingLabour ? "Loading…" : "Load details"}
              </button>
            </div>
            <FieldError message={errors.labourId?.message} />
            {loadError ? (
              <p id="load-err" className="field-error" role="alert">
                {loadError}
              </p>
            ) : null}
            <p className="field-hint">
              Enter the labour registration number, then <strong>Load details</strong> to fetch data
              from the server.
            </p>
          </section>
        ) : null}

        {isManualEntry ? (
          <>
            {labourDetailsGrid}
            <div className="form-footer">
              <button
                type="submit"
                className="btn btn-block btn-primary btn-submit-main"
                disabled={finalSubmitting}
              >
                Review & submit
              </button>
            </div>
          </>
        ) : null}

        {!isManualEntry && loaded ? (
          <>
            <section
              id="member-cards-anchor"
              className="member-cards-section"
              aria-label="Select member to register"
            >
              <span className="field-label" id="member-cards-label" />
              <p className="field-hint field-hint--tight">
                Select a household member to register. The form updates for the selected person.
              </p>
              <div
                className="member-cards"
                role="radiogroup"
                aria-labelledby="member-cards-label"
              >
                {memberCards.map((card) => {
                  const inputId = `reg-member-${card.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  const selected = selectedMemberKey === card.key;
                  return (
                    <label
                      key={card.key}
                      htmlFor={inputId}
                      className={`member-card${selected ? " member-card--selected" : ""}`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="registerMember"
                        className="member-card__radio"
                        value={card.key}
                        checked={selected}
                        onChange={() => selectMemberByKey(card.key)}
                      />
                      <span className="member-card__body">
                        <span className="member-card__top-row">
                          <span className="member-card__name">{card.name}</span>
                          <span
                            className="member-card__meta-row"
                            aria-label={`${card.genderAgeLine}, ${card.role}`}
                          >
                            <span className="member-card__pill">{card.genderAgeLine}</span>
                            <span className="member-card__meta-sep" aria-hidden>
                              ·
                            </span>
                            <span className="member-card__relation">{card.role}</span>
                          </span>
                        </span>
                        <div className="member-card__aadhaar-block">
                          <span className="member-card__aadhaar-label">Aadhaar</span>
                          <span className="member-card__aadhaar" aria-label="Aadhaar number">
                            {card.aadhaarLine}
                          </span>
                        </div>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {labourDetailsGrid}

            <div className="form-footer">
              <button
                type="submit"
                className="btn btn-block btn-primary btn-submit-main"
                disabled={finalSubmitting}
              >
                Review & submit
              </button>
            </div>
          </>
        ) : null}
      </form>

      <div className="powered-by" aria-label="Platform credit">
        <span className="powered-by__label">Powered by</span>
        <img
          src={yoloLogoUrl}
          alt="YoloHealth"
          className="powered-by__logo"
          width={200}
          height={70}
          decoding="async"
        />
      </div>

      {barcodeScanOpen ? (
        <Suspense fallback={null}>
          <BarcodeScanModal
            open
            onClose={() => setBarcodeScanOpen(false)}
            onDetected={(code) => {
              const cleaned = String(code).replace(/[^A-Za-z0-9\-]/g, "").slice(0, 64);
              setValue("mappedBarcode", cleaned, { shouldValidate: true, shouldDirty: true });
              setBarcodeScanOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {livePhotoModalOpen ? (
        <Suspense fallback={null}>
          <LabourLivePhotoModal
            open
            onClose={() => setLivePhotoModalOpen(false)}
            onCaptured={(blob, meta) => {
              const previewUrl = URL.createObjectURL(blob);
              setGeoPhotoSafe({ blob, previewUrl, meta });
              clearErrors("geoTaggedPhoto");
            }}
          />
        </Suspense>
      ) : null}

      <PreviewModal
        open={previewOpen}
        values={previewValues}
        onBack={() => setPreviewOpen(false)}
        onConfirm={onConfirmRegister}
        submitting={finalSubmitting}
      />
    </>
  );
}
