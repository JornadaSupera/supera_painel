import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { BackendPendente, PageHeader } from "@/components/shared";
import { motivoIndisponivel } from "@/services/apiClient";
import type { ResultadoConvite } from "@/types/paciente";
import { ConviteEmitidoDialog } from "../components/ConviteEmitidoDialog";
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

  /*
   * O código de ativação só existe uma vez, e a navegação para a ficha o
   * apagaria da tela antes de alguém anotá-lo. Por isso a ida para a ficha
   * espera o diálogo ser fechado: é o único momento em que dá para saber que a
   * pessoa viu o código.
   */
  const [conviteEmitido, setConviteEmitido] = useState<ResultadoConvite | null>(null);
  const [pacienteCriado, setPacienteCriado] = useState<string | null>(null);

  const irParaFicha = (id: string | null) => navigate(id ? `/pacientes/${id}` : "/pacientes");

  // A rota continua alcançável pela URL mesmo com o botão desabilitado na
  // listagem. Barrar aqui evita o pior caminho: dezesseis campos preenchidos
  // para receber uma recusa no envio.
  const indisponivel = motivoIndisponivel("pacientes.create");

  const salvar = (valores: Valores) => {
    criar.mutate(paraEntrada(valores), {
      onSuccess: ({ paciente, convite }) => {
        // Com código na mão, o diálogo primeiro. Sem ele, vai direto para a
        // ficha: é lá que se confere o que foi cadastrado e se reemite o
        // convite, se preciso.
        if (convite?.token) {
          setPacienteCriado(paciente?.id ?? null);
          setConviteEmitido(convite);
          return;
        }

        irParaFicha(paciente?.id ?? null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Novo paciente"
        backTo="/pacientes"
        backLabel="Pacientes"
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

      <ConviteEmitidoDialog
        convite={conviteEmitido}
        onClose={() => {
          setConviteEmitido(null);
          irParaFicha(pacienteCriado);
        }}
      />
    </div>
  );
}

export default PacienteNovoPage;
