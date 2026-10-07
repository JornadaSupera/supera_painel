import { useNavigate } from "react-router-dom";

import { BackendPendente, PageHeader } from "@/components/shared";
import { useCan } from "@/contexts/auth-context";
import { useMotivoIndisponivel } from "@/hooks/useMotivoIndisponivel";
import { PERMISSAO } from "@/lib/rbac";
import { PacienteForm } from "../components/PacienteForm";
import { useCriarPaciente } from "../hooks/usePacientes";
import { paraClinica, paraEntrada, VALORES_INICIAIS, type PacienteForm as Valores } from "../schemas";

/**
 * Cadastro de paciente.
 *
 * Rota separada da listagem, e não um modal: são quatro etapas com vinte e
 * cinco campos — um diálogo desse tamanho não sobrevive a uma interrupção, e
 * interrupção é a regra em recepção de clínica.
 *
 * Serve aos dois painéis: `basePath` é a listagem de onde se veio, e é para lá
 * que voltam o cancelar e a ficha recém-criada.
 */
export function PacienteNovoPage({
  basePath = "/pacientes",
  eyebrow = "Gestão",
}: {
  basePath?: string;
  eyebrow?: string;
}) {
  const navigate = useNavigate();
  const can = useCan();
  const criar = useCriarPaciente();
  const podeConvidar = can(PERMISSAO.PACIENTES_INVITE);

  // A rota continua alcançável pela URL mesmo com o botão desabilitado na
  // listagem. Barrar aqui evita o pior caminho: o formulário inteiro preenchido
  // para receber uma recusa no envio.
  const indisponivel = useMotivoIndisponivel("pacientes.create");

  const salvar = (valores: Valores) => {
    // Quem não convida não dispara convite, mesmo que o valor inicial da chave
    // seja "ligado": o envio seria recusado logo depois de a ficha existir.
    const preenchida = paraEntrada(valores);
    const entrada = { ...preenchida, enviar_convite: podeConvidar && preenchida.enviar_convite };

    criar.mutate(
      { entrada, clinica: paraClinica(valores) },
      { onSuccess: ({ paciente }) => navigate(paciente ? `${basePath}/${paciente.id}` : basePath) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={eyebrow}
        title="Novo paciente"
        backTo={basePath}
        backLabel="Pacientes"
        breadcrumb={[{ label: "Pacientes", to: basePath }, { label: "Novo paciente" }]}
        subtitle={
          podeConvidar
            ? "O código de acesso ao aplicativo chega por SMS no celular do paciente."
            : "O convite de acesso ao aplicativo é emitido pela administração, depois do cadastro."
        }
      />

      {indisponivel ? (
        <BackendPendente titulo="Cadastro de paciente" motivo={indisponivel} />
      ) : (
        <PacienteForm
          modo="criacao"
          valoresIniciais={VALORES_INICIAIS}
          salvando={criar.isPending}
          onSubmit={salvar}
          onCancelar={() => navigate(basePath)}
        />
      )}
    </div>
  );
}

export default PacienteNovoPage;
