package be.arsuup.setcrack;

import com.google.gson.*;
import javafx.application.Application;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;

public class SetCrack extends Application {

    private static final String folderPath = System.getenv("APPDATA") + File.separator + "tahan-launcher";
    private static final String jsonFilePath = folderPath + File.separator + "launcher-data.json";

    @Override
    public void start(Stage primaryStage) {
        Thread.currentThread().setUncaughtExceptionHandler((thread, throwable) -> {
            throwable.printStackTrace();
        });

        Button btnCrack = new Button("Mode Crack");
        Button btnMicrosoft = new Button("Mode Microsoft");

        btnCrack.setMinWidth(200);
        btnMicrosoft.setMinWidth(200);

        btnCrack.setOnAction(e -> {
            handleUpdate(true);
        });

        btnMicrosoft.setOnAction(e -> {
            handleUpdate(false);
        });

        VBox root = new VBox(15, btnCrack, btnMicrosoft);
        root.setAlignment(Pos.CENTER);
        Scene scene = new Scene(root, 400, 200);

        primaryStage.setTitle("TahanLauncher - Config");
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    private void handleUpdate(boolean value) {
        if (toggleCrackMode(value)) {
            showAlert(Alert.AlertType.INFORMATION, "Succès", "Le fichier a été mis à jour, (Crack: " + value + ")");
        } else {
            showAlert(Alert.AlertType.ERROR, "Erreur", "Impossible de modifier le fichier.\nVérifie qu'il n'est pas utilisé ou crypté.");
        }
    }

    private void showAlert(Alert.AlertType type, String title, String content) {
        Alert alert = new Alert(type);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(content);
        alert.showAndWait();
    }

    public static boolean toggleCrackMode(boolean newValue) {
        File file = new File(jsonFilePath);
        if (!file.exists()) return false;

        try {
            JsonParser parser = new JsonParser();
            JsonObject root = parser.parse(new FileReader(file)).getAsJsonObject();

            JsonArray configClient = root.getAsJsonArray("configClient");

            if (configClient != null && configClient.size() > 0) {
                JsonObject firstConfig = configClient.get(0).getAsJsonObject();
                firstConfig.addProperty("crack", newValue);

                Gson gson = new GsonBuilder().setPrettyPrinting().create();
                try (FileWriter writer = new FileWriter(file)) {
                    gson.toJson(root, writer);
                }
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }
}