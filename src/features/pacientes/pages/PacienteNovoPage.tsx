import { useNavigate } from "react-router-dom";

import { BackendPendente, PageHeader } from "@/components/shared";
import { motivoIndisponivel } from "@/services/apiClient";
import { PacienteForm } from "../components/PacienteForm";
import { useCriarPaciente } from "../hooks/usePacientes";
import { paraEntrada, VALORES_INICIAIS, type PacienteForm as Valores } from "../schemas";

/**
 * Cadastro de paciente.
 *
 * Rota separada da listagem, e não um modal: são três etapas com dezesseis
 * campos — um diálogo desse tamanho não sobrevive a uma interrupção, e
 * interrupção é a regra em recepção de clínica.
 */
export function PacienteNovoPage() {
  const navigate = useNavigate();
  const criar = useCriarPaciente();

  // A rota continua alcançável pela URL mesmo com o botão desabilitado na
  // listagem. Barrar aqui evita o pior caminho: dezesseis campos preenchidos
  // para receber uma recusa no envio.
  const indisponivel = motivoIndisponivel("pacientes.create");

  const salvar = (valores: Valores) => {
    criar.mutate(paraEntrada(valores), {
      // Vai direto para a ficha recém-criada: é lá que se confere o que foi
      // cadastrado e se reenvia o convite, se preciso.
      onSuccess: (paciente) => navigate(paciente ? `/pacientes/${paciente.id}` : "/pacientes"),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Novo paciente"
        backTo="/pacientes"
        backLabel="Pacientes"
        level="MVP"
        breadcrumb={[{ label: "Pacientes", to: "/pacientes" }, { label: "Novo paciente" }]}
        subtitle="O convite de acesso ao aplicativo é enviado por SMS ao final do cadastro."
      />

      {indisponivel ? (
        <BackendPendente titulo="Cadastro de paciente" motivo={indisponivel} />
      ) : (
        <PacienteForm
          modo="criacao"
          valoresIniciais={VALORES_INICIAIS}
          salvando={criar.isPending}
          onSubmit={salvar}
          onCancelar={() => navigate("/pacientes")}
        />
      )}
    </div>
  );
}

export default PacienteNovoPage;
