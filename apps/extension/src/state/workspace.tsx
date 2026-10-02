import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createOcrEngine,
  inspectOcrImage,
  type ImageRegion,
  type OcrError,
} from '@swiss/core/ocr';
import { engineAssets, loadOcrModel } from '../platform/ocr-assets';
import { useIdentityPasswords } from './identity-passwords';
import { useSecretGenerators } from './secret-generation';

const errorMessages: Record<OcrError['code'], string> = {
  'image-too-large': 'Choose an image under 20 MB and 20 million pixels.',
  'unsupported-image': 'Choose a PNG, JPEG or WebP image.',
  'invalid-image': 'This image could not be read. Try another file.',
  'invalid-region': 'Select a region inside the image.',
  'invalid-model': 'The English model is damaged. Try extracting text again.',
  cancelled: 'Recognition cancelled.',
  busy: 'Recognition is already running.',
};
export type WorkspaceImage = {
  blob: Blob;
  name: string;
  width: number;
  height: number;
};
function useWorkspaceState() {
  const identity = useIdentityPasswords();
  const generators = useSecretGenerators();
  const [tool, setTool] = useState<
    | 'base64'
    | 'ocr'
    | 'identity-hash'
    | 'identity-verify'
    | 'api-key'
    | 'jwt-key'
    | 'random-password'
  >('base64');
  const [base64, setBase64] = useState('');
  const [image, setImage] = useState<WorkspaceImage>();
  const [region, setRegion] = useState<ImageRegion>();
  const [output, setOutput] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const model = useRef<ArrayBuffer>(undefined);
  const engine = useRef<ReturnType<typeof createOcrEngine>>(undefined);
  const job = useRef<AbortController>(undefined);
  const selection = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      selection.current++;
      job.current?.abort();
      engine.current?.dispose();
    };
  }, []);
  function cancel() {
    job.current?.abort();
  }
  function clearImage() {
    selection.current++;
    cancel();
    setImage(undefined);
    setRegion(undefined);
    setOutput('');
    setMessage('');
  }
  async function selectImage(blob: Blob, name = 'Pasted image') {
    const version = ++selection.current;
    cancel();
    setImage(undefined);
    setRegion(undefined);
    setOutput('');
    setMessage('');
    const result = await inspectOcrImage(blob);
    if (version !== selection.current || !alive.current) return;
    if (result.ok) setImage({ blob, name, ...result.value });
    else setMessage(errorMessages[result.error.code]);
  }

  async function recognize() {
    if (!image || job.current) return;
    const controller = new AbortController();
    job.current = controller;
    const version = selection.current;
    setBusy(true);
    setOutput('');
    setMessage('Starting OCR…');
    setProgress(0);
    try {
      const englishModel =
        model.current ??
        (await loadOcrModel(controller.signal, (status) => {
          if (
            alive.current &&
            version === selection.current &&
            !controller.signal.aborted
          )
            setMessage(status);
        }));
      controller.signal.throwIfAborted();
      if (!alive.current || version !== selection.current) return;
      model.current = englishModel;
      engine.current ??= createOcrEngine(engineAssets);
      setMessage('Starting OCR…');
      const result = await engine.current.recognize(
        { image: image.blob, region, englishModel },
        {
          signal: controller.signal,
          onProgress: (value) => {
            if (
              alive.current &&
              version === selection.current &&
              !controller.signal.aborted
            ) {
              setProgress(value.fraction);
              setMessage(`${value.stage}…`);
            }
          },
        },
      );
      if (alive.current && version === selection.current) {
        if (controller.signal.aborted) {
          setMessage('Recognition cancelled.');
        } else if (result.ok) {
          setOutput(result.value);
          setMessage(
            result.value.trim()
              ? 'Text extracted locally.'
              : 'No text found. Try a clearer image or a smaller region.',
          );
        } else {
          if (result.error.code === 'invalid-model') model.current = undefined;
          setMessage(errorMessages[result.error.code]);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        model.current = undefined;
        engine.current?.dispose();
        engine.current = undefined;
      }
      if (alive.current && version === selection.current)
        setMessage(
          controller.signal.aborted
            ? 'Recognition cancelled.'
            : 'Could not load OCR. Check your connection and available storage, then try extracting text again.',
        );
    } finally {
      job.current = undefined;
      if (alive.current) setBusy(false);
    }
  }
  function changeRegion(value: ImageRegion | undefined) {
    if (!job.current) {
      setRegion(value);
      setOutput('');
      setMessage('');
    }
  }
  return {
    identity,
    generators,
    tool,
    setTool,
    base64,
    setBase64,
    image,
    selectImage,
    clearImage,
    region,
    changeRegion,
    output,
    message,
    busy,
    progress,
    recognize,
    cancel,
  };
}
const Workspace = createContext<
  ReturnType<typeof useWorkspaceState> | undefined
>(undefined);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return <Workspace.Provider value={state}>{children}</Workspace.Provider>;
}
export function useWorkspace() {
  const state = useContext(Workspace);
  if (!state) throw new Error('Workspace provider missing');
  return state;
}
