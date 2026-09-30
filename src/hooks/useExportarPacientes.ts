import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import { downloadCsv } from "@/lib/csv";
import { call, pacientesApi } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";

/**
 * Exporta a lista de pacientes com os MESMOS filtros da tela, para o painel
 * administrativo e para o clínico. A exportação é a mesma nos dois: o banco
 * aceita as duas contas em `log_data_export`, e o CPF, o telefone e o e-mail
 * saem mascarados no arquivo.
 *
 * A auditoria é registrada antes da requisição: o que precisa ficar gravado é a
 * intenção de extrair a base, mesmo que o download falhe no meio.
 */
export function useExportarPacientes(params: ListParams) {
  return useMutation({
    mutationFn: async () => {
      audit.export("pacientes", { formato: "csv", filtros: params.filters, busca: params.search });

      const { data, count } = await call(() => pacientesApi.export(params));
      if (count === 0) return 0;

      downloadCsv(data, "pacientes");
      return count;
    },
    onSuccess: (quantidade) => {
      if (quantidade === 0) {
        toast.info("Nada para exportar", { description: "Nenhum paciente corresponde ao recorte." });
        return;
      }
      toast.success(`${quantidade} paciente(s) exportado(s)`, {
        description: "CPF, telefone e e-mail saem mascarados no arquivo.",
      });
    },
    onError: (erro) => toast.error("Não foi possível exportar", { description: erro.message }),
  });
}
