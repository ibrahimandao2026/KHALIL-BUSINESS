import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   CONFIGURATION
========================= */

app.use(express.json({ limit: "2mb" }));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================
   DONNÉES TEMPORAIRES
========================= */

/*
  Pour commencer, les données sont gardées
  en mémoire.

  Plus tard, nous connecterons PostgreSQL
  pour conserver définitivement les données.
*/

let products = [
  {
    id: 1,
    name: "Produit exemple",
    purchasePrice: 5000,
    salePrice: 7500,
    stock: 10
  }
];

let sales = [];

let customers = [];

/* =========================
   PAGE PRINCIPALE
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    application: "KHALIL BUSINESS",
    groq_configured: Boolean(
      GROQ_API_KEY
    ),
    model: GROQ_MODEL
  });
});

/* =========================
   TABLEAU DE BORD
========================= */

app.get(
  "/api/dashboard",
  (req, res) => {
    const totalSales = sales.reduce(
      (total, sale) =>
        total + sale.total,
      0
    );

    const totalExpenses = sales.reduce(
      (total, sale) =>
        total +
        sale.quantity *
          sale.purchasePrice,
      0
    );

    const profit =
      totalSales -
      totalExpenses;

    res.json({
      salesCount: sales.length,
      totalSales,
      totalExpenses,
      profit,
      productsCount: products.length,
      customersCount:
        customers.length
    });
  }
);

/* =========================
   PRODUITS
========================= */

app.get(
  "/api/products",
  (req, res) => {
    res.json(products);
  }
);

app.post(
  "/api/products",
  (req, res) => {
    const {
      name,
      purchasePrice,
      salePrice,
      stock
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error:
          "Le nom du produit est obligatoire."
      });
    }

    const product = {
      id: Date.now(),
      name: String(name),
      purchasePrice:
        Number(purchasePrice) || 0,
      salePrice:
        Number(salePrice) || 0,
      stock:
        Number(stock) || 0
    };

    products.push(product);

    res.status(201).json({
      success: true,
      product
    });
  }
);

/* =========================
   CLIENTS
========================= */

app.get(
  "/api/customers",
  (req, res) => {
    res.json(customers);
  }
);

app.post(
  "/api/customers",
  (req, res) => {
    const {
      name,
      phone
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error:
          "Le nom du client est obligatoire."
      });
    }

    const customer = {
      id: Date.now(),
      name: String(name),
      phone: String(phone || "")
    };

    customers.push(customer);

    res.status(201).json({
      success: true,
      customer
    });
  }
);

/* =========================
   VENTES
========================= */

app.get(
  "/api/sales",
  (req, res) => {
    res.json(sales);
  }
);

app.post(
  "/api/sales",
  (req, res) => {
    const {
      productId,
      quantity,
      customerId,
      paymentMethod
    } = req.body;

    const product =
      products.find(
        (p) =>
          p.id ===
          Number(productId)
      );

    if (!product) {
      return res.status(404).json({
        error:
          "Produit introuvable."
      });
    }

    const qty =
      Number(quantity);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return res.status(400).json({
        error:
          "La quantité est invalide."
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        error:
          "Stock insuffisant."
      });
    }

    const total =
      product.salePrice * qty;

    product.stock -= qty;

    const sale = {
      id: Date.now(),
      productId:
        product.id,
      productName:
        product.name,
      quantity: qty,
      purchasePrice:
        product.purchasePrice,
      salePrice:
        product.salePrice,
      total,
      customerId:
        customerId || null,
      paymentMethod:
        paymentMethod ||
        "Espèces",
      createdAt:
        new Date().toISOString()
    };

    sales.push(sale);

    res.status(201).json({
      success: true,
      sale
    });
  }
);

/* =========================
   INTELLIGENCE ARTIFICIELLE
========================= */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      if (!GROQ_API_KEY) {
        return res.status(500).json({
          error:
            "GROQ_API_KEY n'est pas configurée dans Render."
        });
      }

      const message =
        String(
          req.body?.message || ""
        ).trim();

      const history =
        Array.isArray(
          req.body?.messages
        )
          ? req.body.messages
          : [];

      if (!message) {
        return res.status(400).json({
          error:
            "Veuillez écrire un message."
        });
      }

      const totalSales =
        sales.reduce(
          (total, sale) =>
            total + sale.total,
          0
        );

      const totalProfit =
        sales.reduce(
          (total, sale) =>
            total +
            (sale.salePrice -
              sale.purchasePrice) *
              sale.quantity,
          0
        );

      const systemPrompt = `
Tu es KHALIL BUSINESS 🇸🇳.

Tu es un assistant intelligent destiné
aux commerçants, entrepreneurs et petites
entreprises du Sénégal et d'Afrique.

Ton objectif est d'aider l'utilisateur à
gérer et développer son activité.

Tu peux aider pour :

- ventes
- stock
- produits
- clients
- bénéfices
- dépenses
- factures
- marketing
- comptabilité simple
- gestion commerciale
- entrepreneuriat
- analyse des ventes
- idées de développement

Réponds en français simple et professionnel.

DONNÉES ACTUELLES DE L'ENTREPRISE :

Nombre de produits :
${products.length}

Nombre de clients :
${customers.length}

Nombre de ventes :
${sales.length}

Chiffre d'affaires :
${totalSales} FCFA

Bénéfice estimé :
${totalProfit} FCFA

Produits :

${JSON.stringify(products)}

Ventes :

${JSON.stringify(sales)}

RÈGLES :

1. Ne fabrique jamais de chiffres.
2. Utilise les données fournies lorsque
   l'utilisateur demande une analyse.
3. Si une information manque, dis-le.
4. Utilise FCFA pour les montants.
5. Donne des réponses pratiques.
6. Explique étape par étape si nécessaire.
7. Ne demande jamais de mot de passe,
   clé API ou information secrète.
`;

      const messages = [
        {
          role: "system",
          content: systemPrompt
        },

        ...history
          .filter(
            (item) =>
              item &&
              (item.role === "user" ||
                item.role ===
                  "assistant")
          )
          .slice(-10),

        {
          role: "user",
          content: message
        }
      ];

      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${GROQ_API_KEY}`
            },

            body: JSON.stringify({
              model: GROQ_MODEL,
              messages,

              temperature: 0.5,

              max_completion_tokens:
                1500
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Erreur Groq :",
          JSON.stringify(data)
        );

        return res.status(502).json({
          error:
            "KHALIL BUSINESS n'a pas pu contacter l'intelligence artificielle."
        });
      }

      const answer =
        data?.choices?.[0]
          ?.message?.content
          ?.trim();

      if (!answer) {
        return res.status(502).json({
          error:
            "L'intelligence artificielle n'a pas retourné de réponse."
        });
      }

      res.json({
        success: true,
        answer
      });

    } catch (error) {
      console.error(
        "Erreur serveur IA :",
        error
      );

      res.status(500).json({
        error:
          "Une erreur est survenue avec KHALIL BUSINESS."
      });
    }
  }
);

/* =========================
   404
========================= */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Route introuvable."
    });
  }
);

/* =========================
   DÉMARRAGE
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "🇸🇳 KHALIL BUSINESS démarré."
    );

    console.log(
      `Port : ${PORT}`
    );

    console.log(
      `Modèle Groq : ${GROQ_MODEL}`
    );

    console.log(
      `Clé Groq configurée : ${Boolean(
        GROQ_API_KEY
      )}`
    );
  }
);
