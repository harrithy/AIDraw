import { Settings } from "lucide-react";
import { ApiSettingsPanel } from "../panels/ApiSettingsPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import type {
  ImageProviderSettings,
  UpdateImageProviderSettingsPayload
} from "../../types";

type ApiSettingsDialogProps = {
  open: boolean;
  settings: ImageProviderSettings;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

export function ApiSettingsDialog({
  open,
  settings,
  onOpenChange,
  onSave
}: ApiSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="api-settings-dialog" aria-describedby="api-settings-description">
        <DialogHeader>
          <div className="dialog-title-row">
            <div>
              <p className="eyebrow">接口设置</p>
              <DialogTitle>Nowcoding</DialogTitle>
            </div>
            <Settings size={22} />
          </div>
          <DialogDescription id="api-settings-description">
            配置浏览器本地保存的 API Key、Base URL 和模型。
          </DialogDescription>
        </DialogHeader>
        <ApiSettingsPanel settings={settings} onSave={onSave} variant="dialog" autoFocusApiKey={open} />
      </DialogContent>
    </Dialog>
  );
}
