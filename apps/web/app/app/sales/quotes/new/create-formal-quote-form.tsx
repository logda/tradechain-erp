'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { useMutationAttempt } from '../../../_lib/use-mutation-attempt';
import { createMutationRequestKey } from '../../../_lib/mutation-request-key';
import {
  autosaveFormalQuoteDraftAction,
  createFormalQuoteAction,
  updateFormalQuoteDraftAction,
  type FormalQuoteFormState,
} from './actions';
import {
  requiredCandidateProductError,
  requiredCustomerError,
  requiredCustomerProductError,
  requiredManualCustomerError,
  requiredProductError,
  validateCreateFormalQuoteFormData,
} from './formal-quote-validation';
import type { CounterpartyOption } from '../../../_lib/counterparty-options';
import { formatCounterpartyBilingualDisplay } from '../../../_lib/counterparty-display';
import type { ProductOption } from '../../../_lib/product-options';
import { serializeProductOption } from '../../../_lib/product-option-serialization';
import type { QuoteSourceOption } from '../../../_lib/quote-source-options';

type SalesUserOption = {
  id: number;
  label: string;
};

type QuoteAttachmentDraft = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type InitialFormalQuoteFormValue = {
  id: number;
  customerId?: number;
  customerEntryMode?: 'existing' | 'manual';
  customerName?: string;
  customerCode?: string;
  salesUserId?: number;
  sourceCode?: string;
  inquiryDate?: string;
  destination?: string;
  requirements?: string;
  documentType?: 'demand' | 'quote';
  productSource?: 'existing' | 'candidate';
  quoteAttachments?: QuoteAttachmentDraft[];
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    targetPrice?: number;
    salePrice: number;
    imageUrls?: string[];
  }>;
};

const initialState: FormalQuoteFormState = { error: null };
const fallbackError = '创建报价失败';

const formStyle = {
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  justifySelf: 'start',
} satisfies React.CSSProperties;

const softPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '16px',
  padding: '16px',
  background: '#f8fafc',
  display: 'grid',
  gap: '12px',
} satisfies React.CSSProperties;

const helperTextStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const autosaveTextStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const requiredMarkStyle = {
  color: '#dc2626',
  fontWeight: 700,
} satisfies React.CSSProperties;

const fieldErrorTextStyle = {
  margin: 0,
  fontSize: '12px',
  color: '#dc2626',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const chipButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  ...chipButtonStyle,
  borderRadius: '12px',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #0f172a' : '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '12px 14px',
    background: isActive ? '#0f172a' : '#ffffff',
    color: isActive ? '#ffffff' : '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

const dialogOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.32)',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  zIndex: 60,
} satisfies React.CSSProperties;

const dialogCardStyle = {
  width: 'min(960px, 100%)',
  maxHeight: 'min(80vh, 920px)',
  overflow: 'hidden',
  borderRadius: '24px',
  border: '1px solid #d8e1ea',
  background: '#ffffff',
  boxShadow: '0 28px 80px rgba(15, 23, 42, 0.18)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
} satisfies React.CSSProperties;

const pageSize = 8;

function getTodayDateValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatCounterpartyDisplayName(option: CounterpartyOption | null) {
  if (!option) {
    return '';
  }

  return formatCounterpartyBilingualDisplay(option.name, {
    code: option.code,
    fullName: option.shortName,
  });
}

function formatCounterpartyListDisplayName(option: CounterpartyOption) {
  return formatCounterpartyDisplayName(option);
}

function formatProductOptionDisplayName(option: ProductOption | null | undefined) {
  if (!option) {
    return '';
  }

  return [option.sku, option.nameCn, option.nameEn].filter(Boolean).join(' / ');
}

function readDefaultSalePriceFromProductValue(value: string) {
  const defaultSalePrice = Number(value.split('|')[4] ?? '');
  return Number.isFinite(defaultSalePrice) ? String(defaultSalePrice) : '0';
}

function findProductOptionBySerializedValue(
  productOptions: ProductOption[],
  productOptionValue: string,
) {
  return (
    productOptions.find((option) => serializeProductOption(option) === productOptionValue) ??
    null
  );
}

function normalizeProductSalePrice(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveProductSalePrice(
  productOption: ProductOption | null | undefined,
  quantity: number,
) {
  if (!productOption) {
    return null;
  }

  const activeTiers = (productOption.salePriceTiers ?? [])
    .filter((tier) => {
      const price = normalizeProductSalePrice(tier.salePrice);
      return (
        tier.status !== 'inactive' &&
        Number.isFinite(tier.minQuantity) &&
        tier.minQuantity > 0 &&
        price !== null
      );
    })
    .sort((left, right) => right.minQuantity - left.minQuantity);
  const matchedTier = activeTiers.find((tier) => quantity >= tier.minQuantity);
  if (matchedTier) {
    return normalizeProductSalePrice(matchedTier.salePrice);
  }

  return normalizeProductSalePrice(productOption.defaultSalePrice);
}

function isDemandEligibleProduct(option: ProductOption) {
  return (
    option.productStage === 'formal' &&
    Number(option.defaultSalePrice ?? 0) > 0 &&
    Number(option.defaultPurchasePrice ?? 0) > 0
  );
}

function isImageLikeFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name)
  );
}

function resolveInitialCustomer(
  initialQuote: InitialFormalQuoteFormValue | undefined,
  customerOptions: CounterpartyOption[],
) {
  if (!initialQuote?.customerId) {
    return null;
  }

  const matched = customerOptions.find(
    (option) => option.id === initialQuote.customerId,
  );
  if (matched) {
    return matched;
  }

  return {
    id: initialQuote.customerId,
    type: 'customer' as const,
    code: initialQuote.customerCode ?? '',
    name: initialQuote.customerName ?? '',
    shortName: '',
  } satisfies CounterpartyOption;
}

function resolveInitialProductOption(
  initialQuote: InitialFormalQuoteFormValue | undefined,
  productOptions: ProductOption[],
) {
  const firstItem = initialQuote?.items?.[0];
  if (!firstItem) {
    return '';
  }

  const matched = productOptions.find(
    (option) => option.id === firstItem.productId || option.sku === firstItem.sku,
  );
  return matched ? serializeProductOption(matched) : '';
}

function resolveCustomerFieldError(
  error: string | null,
  customerEntryMode: 'existing' | 'manual',
) {
  if (
    error === requiredCustomerProductError ||
    error === requiredCustomerError ||
    error === requiredManualCustomerError
  ) {
    return customerEntryMode === 'manual'
      ? '请填写客户名称后再创建报价'
      : '请选择往来单位后再创建报价';
  }

  return null;
}

function resolveProductFieldError(
  error: string | null,
  productEntryMode: 'existing' | 'candidate',
) {
  if (
    error === requiredCustomerProductError ||
    error === requiredProductError ||
    error === requiredCandidateProductError
  ) {
    return productEntryMode === 'candidate'
      ? '请填写候选产品名称后再创建报价'
      : '请选择商品或切换为候选产品后再创建报价';
  }

  return null;
}

function buildValidatedInputStyle(hasError: boolean) {
  if (!hasError) {
    return inputStyle;
  }

  return {
    ...inputStyle,
    border: '1px solid #dc2626',
    background: '#fff7f7',
  } satisfies React.CSSProperties;
}

export function CreateFormalQuoteForm({
  customerOptions,
  productOptions,
  salesUsers,
  sourceOptions,
  defaultSalesUserId,
  role,
  user,
  access,
  initialQuote,
}: {
  customerOptions: CounterpartyOption[];
  productOptions: ProductOption[];
  salesUsers: SalesUserOption[];
  sourceOptions: QuoteSourceOption[];
  defaultSalesUserId: number;
  role: string;
  user: string;
  access?: string;
  initialQuote?: InitialFormalQuoteFormValue;
}) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const [draftQuoteId, setDraftQuoteId] = useState<number | null>(initialQuote?.id ?? null);
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'waiting' | 'saving' | 'saved' | 'skipped' | 'error'
  >('idle');
  const [autosaveMessage, setAutosaveMessage] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSeqRef = useRef(0);
  const autosaveRunningRef = useRef(false);
  const autosaveQueuedRef = useRef(false);
  const autosavePromiseRef = useRef<Promise<void> | null>(null);
  const autosaveRequestKeyRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);
  const draftQuoteIdRef = useRef<number | null>(initialQuote?.id ?? null);
  const imageFilesInputRef = useRef<HTMLInputElement | null>(null);
  const quoteAttachmentFilesInputRef = useRef<HTMLInputElement | null>(null);
  const [customerEntryMode, setCustomerEntryMode] = useState<'existing' | 'manual'>(
    initialQuote?.customerEntryMode === 'manual' || !initialQuote?.customerId
      ? initialQuote
        ? 'manual'
        : 'existing'
      : 'existing',
  );
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerPickerPage, setCustomerPickerPage] = useState(1);
  const initialProductOption = resolveInitialProductOption(initialQuote, productOptions);
  const initialItem = initialQuote?.items?.[0];
  const initialDocumentType = initialQuote?.documentType;
  const initialProductSource = initialQuote?.productSource;
  const initialQuoteImageUrls = initialItem?.imageUrls ?? [];
  const initialQuoteAttachments = initialQuote?.quoteAttachments ?? [];
  const [documentType, setDocumentType] = useState<'demand' | 'quote'>(
    initialDocumentType ?? 'demand',
  );
  const [productEntryMode, setProductEntryMode] = useState<'existing' | 'candidate'>(
    initialProductSource ??
      (initialQuote && !initialProductOption ? 'candidate' : 'existing'),
  );
  const [submitMode, setSubmitMode] = useState<'draft' | 'submit'>('draft');
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [selectedQuoteAttachmentCount, setSelectedQuoteAttachmentCount] = useState(0);
  const [selectedQuoteAttachmentPreviews, setSelectedQuoteAttachmentPreviews] = useState<
    Array<{ name: string; url: string; isImage: boolean }>
  >([]);
  const [savedQuoteImageUrls, setSavedQuoteImageUrls] = useState(initialQuoteImageUrls);
  const [savedQuoteAttachments, setSavedQuoteAttachments] = useState(initialQuoteAttachments);
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CounterpartyOption | null>(
    resolveInitialCustomer(initialQuote, customerOptions),
  );
  const [selectedProductOption, setSelectedProductOption] = useState(initialProductOption);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productPickerPage, setProductPickerPage] = useState(1);
  const [quantityValue, setQuantityValue] = useState(
    String(initialItem?.quantity ?? 1),
  );
  const [salePriceValue, setSalePriceValue] = useState(
    initialItem ? String(initialItem.salePrice) : '0',
  );
  const formMode = draftQuoteId ? 'edit' : 'create';
  const fallbackSubmitError =
    formMode === 'edit'
      ? documentType === 'demand'
        ? '需求单草稿保存失败'
        : '报价单草稿保存失败'
      : fallbackError;
  const imagePreviewUrlsRef = useRef<string[]>([]);
  const quoteAttachmentPreviewUrlsRef = useRef<string[]>([]);
  const demandProductOptions = productOptions.filter(isDemandEligibleProduct);
  const selectableProductOptions =
    documentType === 'demand' ? demandProductOptions : productOptions;
  const selectedProductOptionRecord = findProductOptionBySerializedValue(
    productOptions,
    selectedProductOption,
  );
  const displayQuoteImages = [
    ...savedQuoteImageUrls.map((url, index) => ({
      url,
      name: `已保存图片 ${index + 1}`,
      source: 'saved' as const,
    })),
    ...selectedImagePreviews.map((preview) => ({
      ...preview,
      source: 'selected' as const,
    })),
  ];
  const shouldAutosaveMediaChangeRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (documentType === 'quote' && productEntryMode !== 'existing') {
      setProductEntryMode('existing');
    }
  }, [documentType, productEntryMode]);

  useEffect(() => {
    draftQuoteIdRef.current = draftQuoteId;
  }, [draftQuoteId]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    quoteAttachmentPreviewUrlsRef.current = selectedQuoteAttachmentPreviews.map(
      (preview) => preview.url,
    );
  }, [selectedQuoteAttachmentPreviews]);

  useEffect(() => {
    imagePreviewUrlsRef.current = selectedImagePreviews.map((preview) => preview.url);
  }, [selectedImagePreviews]);

  useEffect(() => {
    if (!shouldAutosaveMediaChangeRef.current) {
      return;
    }

    shouldAutosaveMediaChangeRef.current = false;
    scheduleAutosave();
  }, [savedQuoteImageUrls, savedQuoteAttachments]);

  useEffect(() => {
    return () => {
      imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      quoteAttachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function runAutosave(seq: number) {
    const form = formRef.current;
    if (!form || isSubmittingRef.current) {
      return;
    }

    autosaveRunningRef.current = true;
    setAutosaveStatus('saving');
    setAutosaveMessage('正在自动保存草稿');
    const formData = new FormData(form);
    formData.set('submitMode', 'draft');
    autosaveRequestKeyRef.current ??= createMutationRequestKey();
    formData.set('idempotencyKey', autosaveRequestKeyRef.current);
    if (draftQuoteIdRef.current) {
      formData.set('quoteId', String(draftQuoteIdRef.current));
    }

    const result = await autosaveFormalQuoteDraftAction(formData);

    if (result.quoteId) {
      autosaveRequestKeyRef.current = null;
      draftQuoteIdRef.current = result.quoteId;
      setDraftQuoteId(result.quoteId);
    }

      if (result.imageUrls) {
        setSavedQuoteImageUrls(result.imageUrls);
        form.querySelectorAll<HTMLInputElement>('input[name="existingQuoteImageUrls"]').forEach((input) => {
          input.value = JSON.stringify(result.imageUrls ?? []);
        });
        if (result.imageUrls.length > 0 && imageFilesInputRef.current) {
        imageFilesInputRef.current.value = '';
        imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        imagePreviewUrlsRef.current = [];
        setSelectedImagePreviews([]);
      }
    }

      if (result.quoteAttachments) {
        setSavedQuoteAttachments(result.quoteAttachments);
        form.querySelectorAll<HTMLInputElement>('input[name="existingQuoteAttachments"]').forEach((input) => {
          input.value = JSON.stringify(result.quoteAttachments ?? []);
        });
        if (result.quoteAttachments.length > 0 && quoteAttachmentFilesInputRef.current) {
        quoteAttachmentFilesInputRef.current.value = '';
        quoteAttachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        quoteAttachmentPreviewUrlsRef.current = [];
        setSelectedQuoteAttachmentPreviews([]);
        setSelectedQuoteAttachmentCount(0);
      }
    }

    if (autosaveSeqRef.current !== seq) {
      return;
    }

    if (result.error) {
      setAutosaveStatus('error');
      setAutosaveMessage(result.error);
      return;
    }

    if (result.skipped) {
      setAutosaveStatus('skipped');
      setAutosaveMessage('完善客户和商品后会自动保存草稿');
      return;
    }

    setAutosaveStatus('saved');
    setAutosaveMessage(
      result.savedAt
        ? `已自动保存 ${new Date(result.savedAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '已自动保存',
    );
  }

  function scheduleAutosave() {
    if (isSubmittingRef.current) {
      return;
    }

    if (autosaveRunningRef.current) {
      autosaveQueuedRef.current = true;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveStatus('waiting');
    setAutosaveMessage('正在等待字段稳定后自动保存草稿');
    const seq = autosaveSeqRef.current + 1;
    autosaveSeqRef.current = seq;
    autosaveTimerRef.current = setTimeout(async () => {
      const running = runAutosave(seq);
      autosavePromiseRef.current = running;
      try {
        await running;
      } finally {
        autosavePromiseRef.current = null;
        autosaveRunningRef.current = false;
        if (autosaveQueuedRef.current && !isSubmittingRef.current) {
          autosaveQueuedRef.current = false;
          scheduleAutosave();
        }
      }
    }, 1500);
  }

  function handleQuoteAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    quoteAttachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const nextPreviews = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      isImage: isImageLikeFile(file),
    }));
    setSelectedQuoteAttachmentPreviews(nextPreviews);
    setSelectedQuoteAttachmentCount(files.length);
  }

  function openImageViewer(index: number) {
    setImageViewerIndex(index);
  }

  function closeImageViewer() {
    setImageViewerIndex(null);
  }

  function moveImageViewer(nextStep: number) {
    if (!displayQuoteImages.length || imageViewerIndex == null) {
      return;
    }

    const nextIndex =
      (imageViewerIndex + nextStep + displayQuoteImages.length) %
      displayQuoteImages.length;
    setImageViewerIndex(nextIndex);
  }

  function removeSavedQuoteImage(url: string) {
    shouldAutosaveMediaChangeRef.current = true;
    setSavedQuoteImageUrls((current) => {
      const nextImages = current.filter((imageUrl) => imageUrl !== url);
      if (imageViewerIndex != null && imageViewerIndex >= nextImages.length) {
        setImageViewerIndex(nextImages.length > 0 ? nextImages.length - 1 : null);
      }
      return nextImages;
    });
  }

  function removeSavedQuoteAttachment(url: string) {
    shouldAutosaveMediaChangeRef.current = true;
    setSavedQuoteAttachments((current) =>
      current.filter((attachment) => attachment.url !== url),
    );
  }

  function handleImageFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []).filter(isImageLikeFile);
    imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImagePreviews(
      files.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    );
  }

  function applyExistingProductSalePrice(
    productOptionValue: string,
    nextQuantityValue: string,
  ) {
    const productOption = findProductOptionBySerializedValue(
      productOptions,
      productOptionValue,
    );
    const quantity = Number(nextQuantityValue);
    const matchedPrice = resolveProductSalePrice(
      productOption,
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    );
    setSalePriceValue(
      matchedPrice === null
        ? readDefaultSalePriceFromProductValue(productOptionValue)
        : String(matchedPrice),
    );
  }

  const filteredCustomerOptions = customerOptions.filter((option) => {
    const keyword = customerSearchQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [option.code, option.name, option.shortName ?? '', option.type]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
  const customerPageCount = Math.max(1, Math.ceil(filteredCustomerOptions.length / pageSize));
  const normalizedCustomerPickerPage = Math.min(customerPickerPage, customerPageCount);
  const pagedCustomerOptions = filteredCustomerOptions.slice(
    (normalizedCustomerPickerPage - 1) * pageSize,
    normalizedCustomerPickerPage * pageSize,
  );
  const filteredProductOptions = selectableProductOptions.filter((option) => {
    const keyword = productSearchQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [option.sku, option.nameCn, option.nameEn, option.category, option.unit]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
  const productPageCount = Math.max(1, Math.ceil(filteredProductOptions.length / pageSize));
  const normalizedProductPickerPage = Math.min(productPickerPage, productPageCount);
  const pagedProductOptions = filteredProductOptions.slice(
    (normalizedProductPickerPage - 1) * pageSize,
    normalizedProductPickerPage * pageSize,
  );
  const customerFieldError = resolveCustomerFieldError(state.error, customerEntryMode);
  const productFieldError = resolveProductFieldError(state.error, productEntryMode);
  const customerInputStyle = buildValidatedInputStyle(Boolean(customerFieldError));
  const productInputStyle = buildValidatedInputStyle(Boolean(productFieldError));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isSubmittingRef.current || attempt.isComplete) {
      return;
    }

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent & {
      submitter?: HTMLElement | null;
    }).submitter as HTMLButtonElement | null | undefined;
    isSubmittingRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (autosavePromiseRef.current) await autosavePromiseRef.current.catch(() => undefined);
    const formData = new FormData(form);
    if (draftQuoteIdRef.current) {
      formData.set('quoteId', String(draftQuoteIdRef.current));
    }
    const nextSubmitMode =
      submitter?.dataset.submitMode === 'submit' ? 'submit' : 'draft';
    formData.set('submitMode', nextSubmitMode);
    const validationError = validateCreateFormalQuoteFormData(formData);
    if (validationError) {
      isSubmittingRef.current = false;
      setState({ error: validationError });
      return;
    }

    const requestKey = attempt.begin();
    if (!requestKey) {
      isSubmittingRef.current = false;
      return;
    }
    formData.set('idempotencyKey', requestKey);
    setIsSubmitting(true);
    setState(initialState);

    try {
      const nextState =
        draftQuoteIdRef.current
          ? await updateFormalQuoteDraftAction(initialState, formData)
          : await createFormalQuoteAction(initialState, formData);
      if (nextState.error) attempt.fail();
      else attempt.succeed();
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) {
        attempt.succeed();
        throw error;
      }

      attempt.fail();
      setState({ error: fallbackSubmitError });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChangeCapture={attempt.resetFailedAfterEdit}
      onKeyDownCapture={handleFormKeyDown}
      onInput={scheduleAutosave}
      onChange={scheduleAutosave}
      style={formStyle}
    >
      {draftQuoteId ? (
        <input type="hidden" name="quoteId" value={String(draftQuoteId)} />
      ) : null}
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="submitMode" value={submitMode} />
      <input type="hidden" name="documentType" value={documentType} />
      <input type="hidden" name="productSource" value={productEntryMode} />
      <input type="hidden" name="customerEntryMode" value={customerEntryMode} />
      <input
        type="hidden"
        name="existingQuoteImageUrls"
        value={JSON.stringify(savedQuoteImageUrls)}
      />
      <input
        type="hidden"
        name="existingQuoteAttachments"
        value={JSON.stringify(savedQuoteAttachments)}
      />
      <input
        type="hidden"
        name="customerId"
        value={customerEntryMode === 'existing' ? String(selectedCustomer?.id ?? '') : ''}
      />
      <input
        type="hidden"
        name="selectedCustomerName"
        value={customerEntryMode === 'existing' ? selectedCustomer?.name ?? '' : ''}
      />
      <input
        type="hidden"
        name="selectedCustomerCode"
        value={customerEntryMode === 'existing' ? selectedCustomer?.code ?? '' : ''}
      />
      {access ? <input type="hidden" name="access" value={access} /> : null}
      {role === 'sales' ? (
        <input type="hidden" name="salesUserId" value={String(defaultSalesUserId)} />
      ) : null}

      <div style={gridStyle}>
        <label style={labelStyle}>
          询单日期 Inquiry Date
          <input
            name="inquiryDate"
            type="date"
            defaultValue={initialQuote?.inquiryDate ?? getTodayDateValue()}
            style={inputStyle}
          />
        </label>

        <div style={labelStyle}>
          <span>客户录入方式 Customer Mode</span>
          <span role="group" aria-label="客户录入方式 Customer Mode" style={segmentedControlStyle}>
            <button
              type="button"
              aria-pressed={customerEntryMode === 'existing'}
              style={buildModeButtonStyle(customerEntryMode === 'existing')}
              onClick={() => setCustomerEntryMode('existing')}
            >
              从往来单位选择
            </button>
            <button
              type="button"
              aria-pressed={customerEntryMode === 'manual'}
              style={buildModeButtonStyle(customerEntryMode === 'manual')}
              onClick={() => setCustomerEntryMode('manual')}
            >
              手动填写客户
            </button>
          </span>
        </div>

        <label style={labelStyle}>
          销售负责人 Sales Owner
          <select
            name="salesUserId"
            defaultValue={String(initialQuote?.salesUserId ?? defaultSalesUserId)}
            disabled={role === 'sales'}
            style={inputStyle}
          >
            {salesUsers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={gridStyle}>
        <label style={labelStyle}>
          来源渠道 Source Code
          <select
            name="sourceCode"
            defaultValue={initialQuote?.sourceCode ?? sourceOptions[0]?.code ?? 'expo'}
            style={inputStyle}
          >
            {sourceOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} / {option.code}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          目的地 Destination
          <input
            name="destination"
            placeholder="如 Los Angeles / Hamburg"
            defaultValue={initialQuote?.destination ?? ''}
            style={inputStyle}
          />
        </label>
      </div>

      <section style={softPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ color: '#0f172a' }}>
              客户 Customer <span style={requiredMarkStyle}>*</span>
            </strong>
            <p style={helperTextStyle}>
              先从往来单位选择；如是临时客户，可改为手动填写并按需同步保存到往来单位。
            </p>
            {customerFieldError ? <p style={fieldErrorTextStyle}>{customerFieldError}</p> : null}
          </div>
          {customerEntryMode === 'existing' ? (
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                setCustomerPickerOpen(true);
                setCustomerSearchQuery('');
                setCustomerPickerPage(1);
              }}
            >
              选择往来单位
            </button>
          ) : null}
        </div>

        {customerEntryMode === 'existing' ? (
          <>
            <div style={gridStyle}>
              <label style={labelStyle}>
                客户编码 Customer Code
                <input
                  aria-label="客户编码 Customer Code"
                  readOnly
                  value={selectedCustomer?.code ?? ''}
                  placeholder="选择往来单位后自动带出"
                  aria-invalid={customerFieldError ? 'true' : 'false'}
                  style={customerInputStyle}
                />
              </label>
              <label style={labelStyle}>
                客户名称 Customer Name
                <input
                  aria-label="客户名称 Customer Name"
                  readOnly
                  value={formatCounterpartyDisplayName(selectedCustomer)}
                  placeholder="选择往来单位后自动带出"
                  aria-invalid={customerFieldError ? 'true' : 'false'}
                  style={customerInputStyle}
                />
              </label>
            </div>
          </>
        ) : (
          <div style={gridStyle}>
            <label style={labelStyle}>
              客户编码 Customer Code
              <input
                name="customerCode"
                placeholder="如 CUST-NORTHWIND"
                defaultValue={initialQuote?.customerCode ?? ''}
                style={customerInputStyle}
              />
            </label>
            <label style={labelStyle}>
              客户名称 Customer Name
              <input
                name="customerName"
                placeholder="填写客户名称"
                defaultValue={initialQuote?.customerName ?? ''}
                aria-invalid={customerFieldError ? 'true' : 'false'}
                style={customerInputStyle}
              />
            </label>
            <label style={{ ...labelStyle, alignContent: 'end' }}>
              <span>同步设置</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                <input name="saveManualCustomerToCounterparty" type="checkbox" />
                同步保存到往来单位 Save to Counterparty
              </span>
            </label>
          </div>
        )}
      </section>

      <fieldset
        style={{
          border: productFieldError ? '1px solid #fecaca' : '1px solid #d8e1ea',
          borderRadius: '12px',
          padding: '16px',
          background: productFieldError ? '#fffdfd' : '#ffffff',
        }}
      >
        <legend style={{ color: '#0f172a', fontWeight: 700 }}>
          {documentType === 'demand' ? '需求明细' : '报价明细'} Line Item <span style={requiredMarkStyle}>*</span>
        </legend>
        {productFieldError ? <p style={fieldErrorTextStyle}>{productFieldError}</p> : null}
        <div style={{ ...gridStyle, marginBottom: '16px' }}>
          <input type="hidden" name="productEntryMode" value={productEntryMode} />
          <div style={labelStyle}>
            <span>单据类型 Document Type</span>
            <span role="group" aria-label="单据类型 Document Type" style={segmentedControlStyle}>
              <button
                type="button"
                aria-pressed={documentType === 'demand'}
                style={buildModeButtonStyle(documentType === 'demand')}
                onClick={() => setDocumentType('demand')}
              >
                需求单
              </button>
              <button
                type="button"
                aria-pressed={documentType === 'quote'}
                style={buildModeButtonStyle(documentType === 'quote')}
                onClick={() => setDocumentType('quote')}
              >
                报价单
              </button>
            </span>
          </div>
          {documentType === 'demand' ? (
            <div style={labelStyle}>
              <span>产品来源 Product Source</span>
              <span role="group" aria-label="产品来源 Product Source" style={segmentedControlStyle}>
                <button
                  type="button"
                  aria-pressed={productEntryMode === 'existing'}
                  style={buildModeButtonStyle(productEntryMode === 'existing')}
                  onClick={() => setProductEntryMode('existing')}
                >
                  产品库产品
                </button>
                <button
                  type="button"
                  aria-pressed={productEntryMode === 'candidate'}
                  style={buildModeButtonStyle(productEntryMode === 'candidate')}
                  onClick={() => setProductEntryMode('candidate')}
                >
                  手填新产品
                </button>
              </span>
            </div>
          ) : null}
        </div>
        <div style={gridStyle}>
          {productEntryMode === 'existing' ? (
            <div style={labelStyle}>
              <span>产品库 Product</span>
              <input
                type="hidden"
                name="productOption"
                value={selectedProductOption}
                readOnly
              />
              <button
                type="button"
                aria-label="选择产品库产品 Product Picker"
                aria-invalid={productFieldError ? 'true' : 'false'}
                style={{
                  ...productInputStyle,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
                onClick={() => {
                  setProductSearchQuery('');
                  setProductPickerPage(1);
                  setProductPickerOpen(true);
                }}
              >
                {selectedProductOptionRecord
                  ? formatProductOptionDisplayName(selectedProductOptionRecord)
                  : '选择产品库产品'}
              </button>
              <p style={helperTextStyle}>
                {selectedProductOptionRecord
                  ? `当前选择：${formatProductOptionDisplayName(selectedProductOptionRecord)}`
                  : '点击打开产品库弹窗搜索并选择产品'}
              </p>
            </div>
          ) : null}
          <label style={labelStyle}>
            数量 Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              value={quantityValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQuantityValue(nextValue);
                if (productEntryMode === 'existing') {
                  applyExistingProductSalePrice(selectedProductOption, nextValue);
                }
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            客户目标价 Target Price
            <input
              name="targetPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(initialItem?.targetPrice ?? 0)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            销售单价 Sale Price
            <input
              name="salePrice"
              type="number"
              step="0.01"
              min="0"
              value={salePriceValue}
              onChange={(event) => setSalePriceValue(event.target.value)}
              style={productInputStyle}
            />
          </label>
        </div>
        {productEntryMode === 'existing' ? (
          <p style={helperTextStyle}>
            仅显示已启用且同时具备采购价、销售价的产品，阶梯价会按数量自动匹配。
          </p>
        ) : (
          <p style={helperTextStyle}>
            仅用于产品库没有的临时产品，提交后继续走原报价、询价与确认流程。
          </p>
        )}
        <label style={labelStyle}>
          上传图片 Upload Images
          <input
            name="imageFiles"
            type="file"
            accept="image/*"
            multiple
            style={inputStyle}
            ref={imageFilesInputRef}
            onChange={handleImageFilesChange}
          />
        </label>
        {displayQuoteImages.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
              gap: '12px',
            }}
          >
            {displayQuoteImages.map((preview, index) => (
              <div
                key={preview.url}
                style={{
                  display: 'grid',
                  gap: '8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '10px',
                  background: '#ffffff',
                  color: '#334155',
                  textAlign: 'left',
                }}
              >
                <button
                  type="button"
                  onClick={() => openImageViewer(index)}
                  style={{
                    display: 'grid',
                    gap: '8px',
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={preview.url}
                    alt={preview.name}
                    style={{
                      width: '100%',
                      height: '110px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</span>
                </button>
                {preview.source === 'saved' ? (
                  <button
                    type="button"
                    aria-label={`删除${preview.name}`}
                    onClick={() => removeSavedQuoteImage(preview.url)}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      background: '#fff7f7',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    删除图片
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            支持一次上传多张真实图片，提交时会随{documentType === 'demand' ? '需求单' : '报价单'}一起保存。
          </p>
        )}
        <label style={labelStyle}>
          {documentType === 'demand' ? '附件 Attachments' : '报价附件 Quote Attachments'}
          <input
            name="quoteAttachmentFiles"
            type="file"
            multiple
            style={inputStyle}
            ref={quoteAttachmentFilesInputRef}
            onChange={handleQuoteAttachmentChange}
          />
        </label>
        {savedQuoteAttachments.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            <span style={helperTextStyle}>
              已保存的{documentType === 'demand' ? '附件' : '报价附件'}
            </span>
            <div style={{ display: 'grid', gap: '8px' }}>
              {savedQuoteAttachments.map((attachment) => (
                <div
                  key={attachment.url}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#0f172a',
                    textDecoration: 'none',
                    fontWeight: 600,
                    border: '1px solid #d8e1ea',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    background: '#fff',
                    textAlign: 'left',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => window.open(attachment.url, '_blank', 'noopener,noreferrer')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      minWidth: 0,
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: '#0f172a',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {attachment.mimeType.startsWith('image/') ? (
                      <img
                        src={attachment.url}
                        alt={attachment.fileName}
                        style={{
                          width: '54px',
                          height: '36px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #d8e1ea',
                          flex: '0 0 auto',
                        }}
                      />
                    ) : null}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachment.fileName}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`删除附件${attachment.fileName}`}
                    onClick={() => removeSavedQuoteAttachment(attachment.url)}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      background: '#fff7f7',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flex: '0 0 auto',
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {selectedQuoteAttachmentPreviews.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            <span style={helperTextStyle}>
              已选择 {selectedQuoteAttachmentCount} 个{documentType === 'demand' ? '附件' : '报价附件'}
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '12px',
              }}
            >
              {selectedQuoteAttachmentPreviews.map((preview) => (
                <button
                  key={preview.url}
                  type="button"
                  onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')}
                  style={{
                    display: 'grid',
                    gap: '8px',
                    padding: '10px',
                    border: '1px solid #d8e1ea',
                    borderRadius: '14px',
                    color: '#0f172a',
                    background: '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {preview.isImage ? (
                    <img
                      src={preview.url}
                      alt={preview.name}
                      style={{
                        width: '100%',
                        height: '96px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                  ) : null}
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{preview.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span style={helperTextStyle}>支持上传合同、报价单据和图片附件，提交时会随报价一起保存。</span>
        )}
        {productEntryMode === 'candidate' ? (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px dashed #d8e1ea',
              display: 'grid',
              gap: '16px',
            }}
          >
            <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>
              新产品需求可先手填待建档信息；提交需求单后进入采购询价，老板定价后再生成关联报价单。
            </p>
            <div style={gridStyle}>
              <label style={labelStyle}>
                产品编码 Product Code
                <input
                  name="candidateSku"
                  readOnly
                  value={initialItem?.sku ?? ''}
                  placeholder="由采购建档时填写或自动生成"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                产品名称 Product Name
                <input
                  name="candidateNameCn"
                  defaultValue={initialItem?.productName ?? ''}
                  aria-invalid={productFieldError ? 'true' : 'false'}
                  style={productInputStyle}
                />
              </label>
              <label style={labelStyle}>
                产品类别 Product Category
                <select name="candidateCategory" defaultValue="electronics" style={inputStyle}>
                  <option value="electronics">electronics / 电子类</option>
                  <option value="consumables">consumables / 耗材类</option>
                  <option value="service">service / 服务类</option>
                </select>
              </label>
            </div>
            <p style={helperTextStyle}>
              产品编码、供应商和采购价由采购在询价阶段补齐；老板确认后启用选中的产品记录。
            </p>
          </div>
        ) : null}
      </fieldset>

      <label style={labelStyle}>
        需求说明 Requirements
        <textarea
          name="requirements"
          rows={5}
          defaultValue={initialQuote?.requirements ?? ''}
          style={inputStyle}
        />
      </label>

      {state.error ? <p role="alert">{state.error}</p> : null}
      {autosaveStatus !== 'idle' ? (
        <p aria-live="polite" style={autosaveTextStyle}>
          {autosaveMessage}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={isSubmitting || attempt.isComplete}
          style={buttonStyle}
          data-submit-mode="draft"
          onClick={() => setSubmitMode('draft')}
        >
          {isSubmitting && submitMode === 'draft'
            ? '保存中...'
            : documentType === 'demand'
              ? '保存需求草稿'
              : '保存报价草稿'}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || attempt.isComplete}
          style={{ ...buttonStyle, background: '#1d4ed8', border: '1px solid #1d4ed8' }}
          data-submit-mode="submit"
          onClick={() => setSubmitMode('submit')}
        >
          {isSubmitting && submitMode === 'submit'
            ? '提交中...'
            : documentType === 'demand'
              ? '提交需求单'
              : '提交报价单'}
        </button>
      </div>

      {productPickerOpen ? (
        <div style={dialogOverlayStyle}>
          <div role="dialog" aria-modal="true" aria-labelledby="product-picker-title" style={dialogCardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '20px 24px 12px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'grid', gap: '6px' }}>
                <h3 id="product-picker-title" style={{ margin: 0, color: '#0f172a' }}>
                  选择产品库产品
                </h3>
                <p style={helperTextStyle}>支持按产品编码、中文名称、英文名称和类别搜索。</p>
              </div>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => setProductPickerOpen(false)}
              >
                关闭
              </button>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'grid',
                gap: '12px',
              }}
            >
              <label style={labelStyle}>
                搜索产品 Search Product
                <input
                  aria-label="搜索产品 Search Product"
                  value={productSearchQuery}
                  onChange={(event) => {
                    setProductSearchQuery(event.target.value);
                    setProductPickerPage(1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                    }
                  }}
                  placeholder="输入产品编码、中文名称、英文名称或类别"
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <p style={helperTextStyle}>共 {filteredProductOptions.length} 条结果</p>
                <p style={helperTextStyle}>第 {normalizedProductPickerPage} / {productPageCount} 页</p>
              </div>
            </div>

            <div style={{ overflow: 'auto', padding: '0 24px 16px' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '840px',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {['产品编码', '产品名称', '产品类别', '单位', '销售价', '操作'].map((title) => (
                      <th
                        key={title}
                        style={{
                          textAlign: title === '操作' ? 'center' : 'left',
                          padding: '12px 16px',
                          fontSize: '13px',
                          color: '#475569',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedProductOptions.length > 0 ? (
                    pagedProductOptions.map((option) => {
                      const optionValue = serializeProductOption(option);
                      return (
                        <tr key={option.id}>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '14px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                              wordBreak: 'break-all',
                            }}
                          >
                            {option.sku}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '14px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                              wordBreak: 'break-word',
                            }}
                          >
                            {option.nameCn} / {option.nameEn}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '14px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                            }}
                          >
                            {option.category}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '14px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                            }}
                          >
                            {option.unit || '-'}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '14px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                            }}
                          >
                            {resolveProductSalePrice(option, Number(quantityValue) || 1) ?? '-'}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              borderBottom: '1px solid #eef2f7',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                            }}
                          >
                            <button
                              type="button"
                              style={chipButtonStyle}
                              onClick={() => {
                                setSelectedProductOption(optionValue);
                                applyExistingProductSalePrice(optionValue, quantityValue);
                                setProductPickerOpen(false);
                              }}
                            >
                              选择
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '18px 16px', textAlign: 'center', color: '#64748b' }}>
                        未找到匹配的产品
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '16px 24px 24px',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <p style={helperTextStyle}>
                当前选中：{selectedProductOptionRecord ? formatProductOptionDisplayName(selectedProductOptionRecord) : '未选择'}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setProductPickerPage((current) => Math.max(1, current - 1))
                  }
                  disabled={normalizedProductPickerPage <= 1}
                >
                  上一页
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setProductPickerPage((current) => Math.min(productPageCount, current + 1))
                  }
                  disabled={normalizedProductPickerPage >= productPageCount}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {customerPickerOpen ? (
        <div style={dialogOverlayStyle}>
          <div role="dialog" aria-modal="true" aria-labelledby="customer-picker-title" style={dialogCardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '20px 24px 12px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'grid', gap: '6px' }}>
                <h3 id="customer-picker-title" style={{ margin: 0, color: '#0f172a' }}>
                  选择往来单位
                </h3>
                <p style={helperTextStyle}>支持按编码、名称搜索，并在弹框中分页选择。</p>
              </div>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => setCustomerPickerOpen(false)}
              >
                关闭
              </button>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'grid',
                gap: '12px',
              }}
            >
              <label style={labelStyle}>
                搜索往来单位 Search Counterparty
                <input
                  aria-label="搜索往来单位 Search Counterparty"
                  value={customerSearchQuery}
                  onChange={(event) => {
                    setCustomerSearchQuery(event.target.value);
                    setCustomerPickerPage(1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                    }
                  }}
                  placeholder="输入编码、名称或类型"
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <p style={helperTextStyle}>共 {filteredCustomerOptions.length} 条结果</p>
                <p style={helperTextStyle}>第 {normalizedCustomerPickerPage} / {customerPageCount} 页</p>
              </div>
            </div>

            <div style={{ overflow: 'auto', padding: '0 24px 16px' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '720px',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#475569',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      编码
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#475569',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      单位名称
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#475569',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      类型
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#475569',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomerOptions.length > 0 ? (
                    pagedCustomerOptions.map((option) => (
                      <tr key={option.id}>
                        <td
                          style={{
                            padding: '14px 16px',
                            fontSize: '14px',
                            borderBottom: '1px solid #eef2f7',
                            verticalAlign: 'middle',
                            wordBreak: 'break-all',
                          }}
                        >
                          {option.code}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            fontSize: '14px',
                            borderBottom: '1px solid #eef2f7',
                            verticalAlign: 'middle',
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatCounterpartyListDisplayName(option)}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            fontSize: '14px',
                            borderBottom: '1px solid #eef2f7',
                            verticalAlign: 'middle',
                          }}
                        >
                          {option.type}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            borderBottom: '1px solid #eef2f7',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          <button
                            type="button"
                            style={chipButtonStyle}
                            onClick={() => {
                              setSelectedCustomer(option);
                              setCustomerPickerOpen(false);
                            }}
                          >
                            选择
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '18px 16px', textAlign: 'center', color: '#64748b' }}>
                        未找到匹配的往来单位
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '16px 24px 24px',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <p style={helperTextStyle}>
                当前选中：{selectedCustomer ? `${selectedCustomer.code} / ${formatCounterpartyDisplayName(selectedCustomer)}` : '未选择'}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setCustomerPickerPage((current) => Math.max(1, current - 1))
                  }
                  disabled={normalizedCustomerPickerPage <= 1}
                >
                  上一页
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setCustomerPickerPage((current) => Math.min(customerPageCount, current + 1))
                  }
                  disabled={normalizedCustomerPickerPage >= customerPageCount}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {imageViewerIndex != null && displayQuoteImages[imageViewerIndex] ? (
        <div style={dialogOverlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            style={{
              width: 'min(1000px, 100%)',
              height: 'min(88vh, 900px)',
              borderRadius: '18px',
              background: '#0f172a',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              overflow: 'hidden',
              boxShadow: '0 28px 80px rgba(15, 23, 42, 0.28)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '14px 18px',
                color: '#fff',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '14px' }}>{displayQuoteImages[imageViewerIndex].name}</strong>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  {imageViewerIndex + 1} / {displayQuoteImages.length}
                </span>
              </div>
              <button
                type="button"
                style={{
                  ...secondaryButtonStyle,
                  background: 'transparent',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.18)',
                }}
                onClick={closeImageViewer}
              >
                关闭
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                padding: '18px',
                overflow: 'auto',
                background: '#111827',
              }}
            >
              <img
                src={displayQuoteImages[imageViewerIndex].url}
                alt={displayQuoteImages[imageViewerIndex].name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderTop: '1px solid rgba(255,255,255,0.12)',
                background: '#0f172a',
              }}
            >
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => moveImageViewer(-1)}
              >
                上一张
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => moveImageViewer(1)}
              >
                下一张
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
