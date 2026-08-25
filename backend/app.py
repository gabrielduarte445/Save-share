from flask import Flask, render_template, request, jsonify

import os

import firebase_admin
from firebase_admin import credentials, firestore, auth


app = Flask(
    __name__,
    template_folder="../public",
    static_folder="../public",
    static_url_path=""
)


# ---------------------------------
# CONEXÃO COM O FIREBASE
# ---------------------------------
CAMINHO_CREDENCIAL = os.path.join(
    os.path.dirname(__file__),
    "firebase-service-account.json"
)
cred = credentials.Certificate(
    CAMINHO_CREDENCIAL
)

firebase_admin.initialize_app(cred)

db = firestore.client()

# ---------------------------------
# PÁGINA DE CADASTRO
# ---------------------------------

@app.route("/")
def cadastro():
    return render_template("cadastro.html")


# ---------------------------------
# CADASTRO
# ---------------------------------

@app.route("/cadastrar", methods=["POST"])
def cadastrar():

    try:

        dados = request.get_json()

        token = dados.get("token")

        if not token:
            return jsonify({
                "erro": "Token não enviado."
            }), 401


        # Verifica se o usuário realmente está autenticado
        usuario = auth.verify_id_token(token)

        uid = usuario["uid"]


        # Dados recebidos do formulário
        nome = dados.get("nome")
        telefone = dados.get("telefone")
        email = dados.get("email")
        tipo_usuario = dados.get("tipo_usuario")


        # Validação básica
        if not nome or not telefone or not email:
            return jsonify({
                "erro": "Preencha todos os campos obrigatórios."
            }), 400


        # Dados comuns
        dados_usuario = {
            "nome": nome,
            "telefone": telefone,
            "email": email,
            "tipo_usuario": tipo_usuario,
            "data_cadastro": firestore.SERVER_TIMESTAMP
        }


        # ---------------------------------
        # CLIENTE
        # ---------------------------------

        if tipo_usuario == "cliente":

            cpf = dados.get("cpf")
            data_nascimento = dados.get("data_nascimento_cliente")

            if not cpf or not data_nascimento:
                return jsonify({
                    "erro": "CPF e data de nascimento são obrigatórios."
                }), 400

            dados_usuario["cpf"] = cpf
            dados_usuario["data_nascimento"] = data_nascimento


        # ---------------------------------
        # COMERCIANTE
        # ---------------------------------

        elif tipo_usuario == "comerciante":

            cnpj = dados.get("cnpj")
            nome_loja = dados.get("nome_loja")
            data_abertura = dados.get("data_abertura")

            if not cnpj or not nome_loja or not data_abertura:
                return jsonify({
                    "erro": "CNPJ, nome da loja e data de abertura são obrigatórios."
                }), 400

            dados_usuario["cnpj"] = cnpj
            dados_usuario["nome_loja"] = nome_loja
            dados_usuario["data_abertura"] = data_abertura


        else:

            return jsonify({
                "erro": "Tipo de usuário inválido."
            }), 400


        # ---------------------------------
        # SALVAR NO FIRESTORE
        # ---------------------------------

        db.collection("usuarios").document(uid).set(
            dados_usuario
        )


        return jsonify({
            "sucesso": True,
            "mensagem": "Cadastro realizado com sucesso!"
        })


    except Exception as erro:

        print("ERRO:", erro)

        return jsonify({
            "erro": "Erro ao realizar cadastro."
        }), 500


# ---------------------------------
# INICIAR SERVIDOR
# ---------------------------------

if __name__ == "__main__":
    app.run(debug=True)