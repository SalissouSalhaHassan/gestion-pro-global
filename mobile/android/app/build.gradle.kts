import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = project.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.example.gestion_pro_mobile"
    // ✅ التعديل هنا: رفعنا الرقم إلى 36 كما طلب الخطأ
    compileSdk = 36 
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId = "com.example.gestion_pro_mobile"
        minSdk = flutter.minSdkVersion // نحتفظ به 21
        
        // ✅ التعديل هنا أيضاً
        targetSdk = 36
        
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias") ?: "my-key-alias"
            keyPassword = keystoreProperties.getProperty("keyPassword") ?: "123456"
            storePassword = keystoreProperties.getProperty("storePassword") ?: "123456"
            
            val fileName = keystoreProperties.getProperty("storeFile") ?: "my-release-key.jks"
            storeFile = project.file(fileName)
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("androidx.fragment:fragment-ktx:1.6.2") 
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
