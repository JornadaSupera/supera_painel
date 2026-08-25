import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/shared";
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
        titulo="Novo paciente"
        nivel="MVP"
        breadcrumb={[{ label: "Pacientes", to: "/pacientes" }, { label: "Novo paciente" }]}
        subtitulo="O convite de acesso ao aplicativo é enviado por SMS ao final do cadastro."
      />

      <PacienteForm
        modo="criacao"
        valoresIniciais={VALORES_INICIAIS}
        salvando={criar.isPending}
        onSubmit={salvar}
        onCancelar={() => navigate("/pacientes")}
      />
    </div>
  );
}

export default PacienteNovoPage;
