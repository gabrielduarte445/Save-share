document.addEventListener("DOMContentLoaded", () => {

    const campoCep = document.getElementById("cep");
    const campoRua = document.getElementById("rua");
    const campoBairro = document.getElementById("bairro");
    const campoCidade = document.getElementById("cidade");
    const campoEstado = document.getElementById("estado");

    if (!campoCep) return;

    campoCep.addEventListener("blur", async () => {
        const cep = campoCep.value.replace(/\D/g, "");

        if (cep.length !== 8) return;

        try {
            const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await resposta.json();

            if (dados.erro) {
                alert("CEP não encontrado.");
                return;
            }

            campoRua.value = dados.logradouro || "";
            campoBairro.value = dados.bairro || "";
            campoCidade.value = dados.localidade || "";
            campoEstado.value = dados.uf || "";

        } catch (erro) {
            console.error("Erro ao buscar CEP:", erro);
        }
    });

    campoCep.addEventListener("input", () => {
        let valor = campoCep.value.replace(/\D/g, "");
        if (valor.length > 5) {
            valor = valor.slice(0, 5) + "-" + valor.slice(5, 8);
        }
        campoCep.value = valor;
    });

});