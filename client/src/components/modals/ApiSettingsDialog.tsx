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

/** ApiSettingsDialog 组件的 Props 类型 */
type ApiSettingsDialogProps = {
  open: boolean;
  settings: ImageProviderSettings;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: UpdateImageProviderSettingsPayload) => Promise<void>;
};

/**
 * API 设置对话框，包装 ApiSettingsPanel 的模态窗口。
 * 管理 Base URL、API Key、模型选择等绘图接口配置。
 */
export function ApiSettingsDialog({
  open,
  settings,
  onOpenChange,
  onSave
}: ApiSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="api-settings-dialog">
        <DialogHeader>
          <div className="dialog-title-row">
            <div>
              <p className="eyebrow">接口设置</p>
              <DialogTitle className="sr-only">API 接口设置</DialogTitle>
            </div>
            <Settings size={22} />
          </div>
          <DialogDescription>
            配置浏览器本地保存的 API Key，并选择要使用的 API 供应商。
          </DialogDescription>
        </DialogHeader>
        <ApiSettingsPanel settings={settings} onSave={onSave} variant="dialog" autoFocusApiKey={open} />
      </DialogContent>
    </Dialog>
  );
}
